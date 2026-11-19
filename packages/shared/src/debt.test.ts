import { describe, expect, it } from 'vitest';
import { debtAnchorDeltas, debtBalanceAt, debtStatus, debtSummary, type DebtLedger } from './debt';

const at = (date: string, time = '12:00') => `${date}T${time}:00.000Z`;

describe('debtBalanceAt (V3)', () => {
  const ledger: DebtLedger = {
    anchors: [
      { date: '2026-01-10', recordedAt: at('2026-11-01'), amount: 100000 },
      { date: '2026-11-01', recordedAt: at('2026-11-01', '12:01'), amount: 130000 },
    ],
    payments: [
      { date: '2026-11-05', recordedAt: at('2026-11-05'), amount: 20000 },
      { date: '2026-11-20', recordedAt: at('2026-11-20'), amount: 10000 },
    ],
  };

  it('antes da primeira âncora a dívida vale 0', () => expect(debtBalanceAt(ledger, '2026-01-09')).toBe(0));
  it('entre âncoras vale a última âncora', () => expect(debtBalanceAt(ledger, '2026-06-30')).toBe(100000));
  it('desconta os pagamentos depois da última âncora, até a data', () => {
    expect(debtBalanceAt(ledger, '2026-11-01')).toBe(130000);
    expect(debtBalanceAt(ledger, '2026-11-10')).toBe(110000);
    expect(debtBalanceAt(ledger, '2026-12-31')).toBe(100000);
  });
  it('no mesmo dia, o pagamento registrado depois da âncora conta e o de antes não', () => {
    const sameDay: DebtLedger = {
      anchors: [{ date: '2026-11-18', recordedAt: at('2026-11-18', '10:00'), amount: 50000 }],
      payments: [
        { date: '2026-11-18', recordedAt: at('2026-11-18', '09:00'), amount: 1000 },
        { date: '2026-11-18', recordedAt: at('2026-11-18', '11:00'), amount: 2000 },
      ],
    };
    expect(debtBalanceAt(sameDay, '2026-11-18')).toBe(48000);
  });
  it('nunca fica negativo', () => {
    expect(debtBalanceAt({ anchors: [ledger.anchors[0]!], payments: [{ date: '2026-02-01', recordedAt: at('2026-02-01'), amount: 999999 }] }, '2026-03-01')).toBe(0);
  });
  it('a ordem de entrada não importa', () => {
    const shuffled = { anchors: [...ledger.anchors].reverse(), payments: [...ledger.payments].reverse() };
    expect(debtBalanceAt(shuffled, '2026-11-10')).toBe(110000);
  });
});

describe('debtSummary (V6)', () => {
  it('original, juros e multas, descontos, pago e saldo fecham a conta', () => {
    const ledger: DebtLedger = {
      anchors: [
        { date: '2026-01-10', recordedAt: at('2026-11-01'), amount: 100000 },
        { date: '2026-11-01', recordedAt: at('2026-11-01', '12:01'), amount: 130000 },
        // acordo por 90.000 depois de pagar 20.000: saldo era 110.000 → desconto de 20.000
        { date: '2026-11-10', recordedAt: at('2026-11-10'), amount: 90000 },
      ],
      payments: [
        { date: '2026-11-05', recordedAt: at('2026-11-05'), amount: 20000 },
        { date: '2026-11-10', recordedAt: at('2026-11-10', '12:01'), amount: 30000 },
      ],
    };
    const s = debtSummary(ledger, '2026-11-18');
    expect(s).toEqual({ original: 100000, interest: 30000, discounts: 20000, paid: 50000, balance: 60000, fraction: 50000 / 110000 });
    expect(s.original + s.interest - s.discounts - s.paid).toBe(s.balance);
  });
  it('sem âncoras: tudo zero e fração 1', () => {
    expect(debtSummary({ anchors: [], payments: [] }, '2026-11-18')).toEqual({ original: 0, interest: 0, discounts: 0, paid: 0, balance: 0, fraction: 1 });
  });
  it('ignora o que vem depois de hoje', () => {
    const s = debtSummary(
      { anchors: [{ date: '2026-11-01', recordedAt: at('2026-11-01'), amount: 10000 }], payments: [{ date: '2026-12-01', recordedAt: at('2026-12-01'), amount: 5000 }] },
      '2026-11-18',
    );
    expect(s).toMatchObject({ paid: 0, balance: 10000, fraction: 0 });
  });
});

describe('debtStatus (V9)', () => {
  it('quitada, em atraso, em acordo e em aberto', () => {
    expect(debtStatus({ balance: 0, lastAnchorIsAgreement: true, hasOverdueInstallment: true })).toBe('paid_off');
    expect(debtStatus({ balance: 10, lastAnchorIsAgreement: true, hasOverdueInstallment: true })).toBe('late');
    expect(debtStatus({ balance: 10, lastAnchorIsAgreement: true, hasOverdueInstallment: false })).toBe('agreement');
    expect(debtStatus({ balance: 10, lastAnchorIsAgreement: false, hasOverdueInstallment: false })).toBe('open');
  });
});

describe('debtAnchorDeltas (V6)', () => {
  it('a primeira âncora é null; as outras são o valor novo menos o saldo logo antes', () => {
    const deltas = debtAnchorDeltas({
      anchors: [
        { id: 'b', date: '2026-11-10', recordedAt: at('2026-11-10'), amount: 90000 },
        { id: 'a', date: '2026-01-10', recordedAt: at('2026-11-01'), amount: 100000 },
      ],
      payments: [
        { date: '2026-11-05', recordedAt: at('2026-11-05'), amount: 20000 },
        { date: '2026-11-10', recordedAt: at('2026-11-10', '13:00'), amount: 5000 },
      ],
    });
    expect(deltas.get('a')).toBeNull();
    expect(deltas.get('b')).toBe(10000); // 80.000 → 90.000; o pagamento das 13h veio depois
  });
});
