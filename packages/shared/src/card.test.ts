import { describe, expect, it } from 'vitest';
import { installmentDate, invoiceDates, invoiceFor, invoiceStatus, splitInstallments } from './card';

describe('invoiceFor', () => {
  it('compra até o fechamento cai na fatura que fecha no mês (vence no seguinte quando o vencimento é antes do fechamento)', () => {
    expect(invoiceFor('2026-11-01', 26, 5)).toEqual({ invoiceMonth: '2026-12', closingDate: '2026-11-26', dueDate: '2026-12-05' });
    expect(invoiceFor('2026-11-26', 26, 5)).toEqual({ invoiceMonth: '2026-12', closingDate: '2026-11-26', dueDate: '2026-12-05' });
  });
  it('compra depois do fechamento vai para a fatura seguinte', () => {
    expect(invoiceFor('2026-11-27', 26, 5)).toEqual({ invoiceMonth: '2027-01', closingDate: '2026-12-26', dueDate: '2027-01-05' });
  });
  it('fechamento no dia 31 em fevereiro vira o último dia do mês', () => {
    expect(invoiceFor('2026-02-28', 31, 10)).toEqual({ invoiceMonth: '2026-03', closingDate: '2026-02-28', dueDate: '2026-03-10' });
  });
  it('vencimento depois do fechamento vence no mesmo mês do fechamento', () => {
    expect(invoiceFor('2026-11-10', 3, 20)).toEqual({ invoiceMonth: '2026-12', closingDate: '2026-12-03', dueDate: '2026-12-20' });
  });
  it('invoiceDates reconstrói fechamento e vencimento de uma fatura', () => {
    expect(invoiceDates('2027-01', 26, 5)).toEqual({ closingDate: '2026-12-26', dueDate: '2027-01-05' });
    expect(invoiceDates('2026-12', 3, 20)).toEqual({ closingDate: '2026-12-03', dueDate: '2026-12-20' });
  });
});

describe('splitInstallments', () => {
  it('divide em centavos e a 1ª parcela leva o resto', () => {
    expect(splitInstallments(120000, 10)).toEqual(Array(10).fill(12000));
    expect(splitInstallments(100000, 3)).toEqual([33334, 33333, 33333]);
    expect(splitInstallments(100000, 3).reduce((a, b) => a + b, 0)).toBe(100000);
  });
});

describe('installmentDate', () => {
  it('parcela k conta na data da compra + (k−1) meses, limitada ao fim do mês', () => {
    expect(installmentDate('2026-01-31', 1)).toBe('2026-01-31');
    expect(installmentDate('2026-01-31', 2)).toBe('2026-02-28');
    expect(installmentDate('2026-11-15', 3)).toBe('2027-01-15');
  });
});

describe('invoiceStatus', () => {
  const base = { closingDate: '2026-11-26', dueDate: '2026-12-05', amount: 50000 };
  it('aberta antes do fechamento', () => expect(invoiceStatus({ ...base, today: '2026-11-25', paid: 0 })).toBe('open'));
  it('fechada entre fechamento e vencimento', () => expect(invoiceStatus({ ...base, today: '2026-11-26', paid: 0 })).toBe('closed'));
  it('paga quando os pagamentos cobrem o valor', () => expect(invoiceStatus({ ...base, today: '2026-11-30', paid: 50000 })).toBe('paid'));
  it('vencida depois do vencimento sem quitação', () => expect(invoiceStatus({ ...base, today: '2026-12-06', paid: 10000 })).toBe('overdue'));
});
