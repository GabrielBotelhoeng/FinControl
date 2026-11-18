import { describe, expect, it } from 'vitest';
import { plainText } from './assistant.service';

describe('plainText (A12)', () => {
  it('tira o markdown que o modelo usou em produção', () => {
    const reply = 'Gabriel, aqui está:\n\n**Últimos 6 meses (maio a outubro):**\nSem lançamentos.\n\n## Metas\n* Viagem: *no ritmo*\n• Reserva\n\n\n\nUse `Relatórios`.';
    expect(plainText(reply)).toBe('Gabriel, aqui está:\n\nÚltimos 6 meses (maio a outubro):\nSem lançamentos.\n\nMetas\n- Viagem: no ritmo\n- Reserva\n\nUse Relatórios.');
  });

  it('não mexe em texto puro, valores e listas com hífen', () => {
    const reply = 'Você gastou R$ 1.234,56 (12% a mais).\n- Mercado: R$ 500,00\n- 2 * 3 = 6';
    expect(plainText(reply)).toBe(reply);
  });
});
