import { describe, expect, it } from 'vitest';
import { daysLabel, DEFAULT_NOTIFICATION_PREFS, dueSoon, goalReachedVisible, notificationPrefs, sortNotifications } from './notifications';

describe('notificationPrefs (N7)', () => {
  it('sem nada gravado: tudo ligado e 3 dias', () => {
    expect(notificationPrefs({})).toEqual({ bills: true, invoices: true, budget: true, goals: true, billDays: 3 });
    expect(notificationPrefs(null)).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });
  it('mantém o que é válido e ignora o resto', () => {
    expect(notificationPrefs({ budget: false, billDays: 7, goals: 'sim', extra: 1 })).toEqual({ bills: true, invoices: true, budget: false, goals: true, billDays: 7 });
    expect(notificationPrefs({ billDays: 5 }).billDays).toBe(3);
    expect(notificationPrefs('x').bills).toBe(true);
  });
});

describe('dueSoon (N4 a)', () => {
  it('de hoje até hoje + N dias, contando os dois', () => {
    expect(dueSoon('2026-11-17', '2026-11-17', 3)).toBe(true);
    expect(dueSoon('2026-11-20', '2026-11-17', 3)).toBe(true);
    expect(dueSoon('2026-11-21', '2026-11-17', 3)).toBe(false);
    expect(dueSoon('2026-11-16', '2026-11-17', 3)).toBe(false);
  });
  it('atravessa o mês', () => expect(dueSoon('2026-12-01', '2026-11-30', 1)).toBe(true));
});

describe('daysLabel', () => {
  it('futuro, hoje e passado em português', () => {
    expect(daysLabel('2026-11-17', '2026-11-17')).toBe('vence hoje');
    expect(daysLabel('2026-11-18', '2026-11-17')).toBe('vence amanhã');
    expect(daysLabel('2026-11-19', '2026-11-17')).toBe('vence em 2 dias');
    expect(daysLabel('2026-11-16', '2026-11-17')).toBe('venceu ontem');
    expect(daysLabel('2026-11-12', '2026-11-17')).toBe('venceu há 5 dias');
  });
});

describe('sortNotifications (N5)', () => {
  it('prioridade primeiro; na mesma prioridade, a data mais antiga primeiro', () => {
    const list = [
      { key: 'meta', priority: 4, date: '2026-11-01' },
      { key: 'vence', priority: 2, date: '2026-11-19' },
      { key: 'vencida-nova', priority: 1, date: '2026-11-15' },
      { key: 'estourou', priority: 2, date: '2026-11-01' },
      { key: 'vencida-velha', priority: 1, date: '2026-11-02' },
    ];
    expect(sortNotifications(list).map((n) => n.key)).toEqual(['vencida-velha', 'vencida-nova', 'estourou', 'vence', 'meta']);
  });
});

describe('goalReachedVisible (N4 e)', () => {
  it('aparece por 30 dias a partir da primeira vez', () => {
    const first = new Date('2026-10-18T12:00:00Z');
    expect(goalReachedVisible(first, new Date('2026-11-16T12:00:00Z'))).toBe(true);
    expect(goalReachedVisible(first, new Date('2026-11-18T12:00:00Z'))).toBe(false);
    expect(goalReachedVisible(null, new Date())).toBe(true);
  });
});
