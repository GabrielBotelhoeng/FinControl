import { describe, expect, it } from 'vitest';
import { loanSummary, outstandingBalance } from './loan';
import { cardCreditAt, cardDebtAt, changeRatio, csvCell, loanOutstandingAt, pdfSafe, reportPeriod, seriesMonths, toCsv } from './reports';

describe('reportPeriod (R1, R3)', () => {
  it('um mês compara com o mês anterior, atravessando o ano', () => {
    expect(reportPeriod('2026-01', '2026-01')).toEqual({ months: 1, previousFrom: '2025-12', previousTo: '2025-12' });
  });
  it('um ano compara com o ano anterior', () => {
    expect(reportPeriod('2026-01', '2026-12')).toEqual({ months: 12, previousFrom: '2025-01', previousTo: '2025-12' });
  });
  it('recusa fim antes do início e mais de 24 meses', () => {
    expect(() => reportPeriod('2026-05', '2026-04')).toThrow();
    expect(() => reportPeriod('2024-01', '2026-01')).toThrow();
    expect(reportPeriod('2024-02', '2026-01').months).toBe(24);
  });
});

describe('seriesMonths (R4)', () => {
  it('no mínimo 6 meses, terminando no fim do período', () => {
    expect(seriesMonths('2026-02', '2026-02')).toEqual(['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']);
  });
  it('período maior que 6 meses usa o período inteiro', () => {
    const list = seriesMonths('2026-01', '2026-12');
    expect(list).toHaveLength(12);
    expect(list[0]).toBe('2026-01');
    expect(list[11]).toBe('2026-12');
  });
});

describe('changeRatio (R3)', () => {
  it('critério 1: 5.000 contra 4.000 = +25%; 3.000 contra 2.000 = +50%', () => {
    expect(changeRatio(500000, 400000)).toBe(0.25);
    expect(changeRatio(300000, 200000)).toBe(0.5);
  });
  it('queda é negativa', () => expect(changeRatio(50, 100)).toBe(-0.5));
  it('sem valor anterior não há percentual', () => expect(changeRatio(100, 0)).toBeNull());
});

describe('cardDebtAt (R5)', () => {
  // Compra de R$ 1.200 em 12x feita em 10/03: cada parcela tem a data da compra como início.
  const charges = Array.from({ length: 12 }, () => ({ amount: 10000, startDate: '2026-03-10' }));
  const card = { initialBalance: 0, charges, credits: [{ amount: 10000, date: '2026-04-15' }] };

  it('critério 2: a compra parcelada vira dívida inteira no mês da compra', () => {
    expect(cardDebtAt(card, '2026-03-31')).toBe(120000);
  });
  it('critério 2: depois de pagar a 1ª fatura de R$ 100, cai para R$ 1.100', () => {
    expect(cardDebtAt(card, '2026-04-30')).toBe(110000);
  });
  it('antes da compra não há dívida', () => expect(cardDebtAt(card, '2026-02-28')).toBe(0));
  it('estorno e pagamento a mais não deixam a dívida negativa', () => {
    expect(cardDebtAt({ initialBalance: 0, charges: [{ amount: 5000, startDate: '2026-01-01' }], credits: [{ amount: 9000, date: '2026-01-02' }] }, '2026-01-31')).toBe(0);
  });
  it('saldo inicial negativo do cartão é dívida', () => {
    expect(cardDebtAt({ initialBalance: -3000, charges: [], credits: [] }, '2026-01-31')).toBe(3000);
  });
});

describe('cardCreditAt (B1 do sub-projeto 11)', () => {
  const overpaid = { initialBalance: 0, charges: [{ amount: 5000, startDate: '2026-01-01' }], credits: [{ amount: 9000, date: '2026-01-02' }] };
  it('o que foi pago a mais (ou estornado depois do pagamento) é crédito, a partir da data', () => {
    expect(cardCreditAt(overpaid, '2026-01-01')).toBe(0);
    expect(cardCreditAt(overpaid, '2026-01-02')).toBe(4000);
    expect(cardDebtAt(overpaid, '2026-01-02')).toBe(0);
  });
  it('com dívida não há crédito; saldo inicial positivo é crédito', () => {
    expect(cardCreditAt({ ...overpaid, credits: [] }, '2026-01-31')).toBe(0);
    expect(cardCreditAt({ initialBalance: 2500, charges: [], credits: [] }, '2026-01-31')).toBe(2500);
  });
});

describe('loanOutstandingAt (R6)', () => {
  const principal = 4000000;
  const installmentAmount = 120000;
  const installmentsTotal = 48;
  const { monthlyRate } = loanSummary({ principal, installmentAmount, installmentsTotal, installmentsPaid: 0 });
  const base = { installmentAmount, monthlyRate, installmentsTotal, installmentsPaidBefore: 0, firstDueDate: '2026-03-10', createdAt: '2026-11-17', paidDates: [] as string[] };

  it('antes do mês anterior à 1ª parcela o empréstimo não existia', () => {
    expect(loanOutstandingAt(base, '2026-01-31')).toBe(0);
  });
  it('no mês da contratação vale o saldo com todas as parcelas', () => {
    expect(loanOutstandingAt(base, '2026-02-28')).toBe(outstandingBalance(installmentAmount, monthlyRate, 48));
  });
  it('parcelas pagas no app até a data reduzem o saldo; as pagas depois, não', () => {
    const loan = { ...base, paidDates: ['2026-03-10', '2026-04-12'] };
    expect(loanOutstandingAt(loan, '2026-03-31')).toBe(outstandingBalance(installmentAmount, monthlyRate, 47));
    expect(loanOutstandingAt(loan, '2026-04-30')).toBe(outstandingBalance(installmentAmount, monthlyRate, 46));
  });
  it('parcelas pagas antes do cadastro contam como pagas no vencimento', () => {
    const loan = { ...base, installmentsPaidBefore: 12, firstDueDate: '2025-01-10' };
    expect(loanOutstandingAt(loan, '2025-06-30')).toBe(outstandingBalance(installmentAmount, monthlyRate, 42));
    expect(loanOutstandingAt(loan, '2026-11-30')).toBe(outstandingBalance(installmentAmount, monthlyRate, 36));
  });
  it('critério 3: no mês atual, igual ao saldo devedor da tela do empréstimo', () => {
    const loan = { ...base, installmentsPaidBefore: 12, firstDueDate: '2025-01-10', paidDates: ['2026-01-10', '2026-02-10'] };
    const screen = loanSummary({ principal, installmentAmount, installmentsTotal, installmentsPaid: 14 }).outstanding;
    expect(loanOutstandingAt(loan, '2026-11-30')).toBe(screen);
  });
  it('parcela "já paga" que ainda não venceu conta como paga no dia do cadastro (adiantada)', () => {
    const loan = { ...base, installmentsPaidBefore: 12, firstDueDate: '2026-01-10', createdAt: '2026-11-17' };
    expect(loanOutstandingAt(loan, '2026-11-30')).toBe(outstandingBalance(installmentAmount, monthlyRate, 36));
    expect(loanOutstandingAt(loan, '2026-10-31')).toBe(outstandingBalance(installmentAmount, monthlyRate, 38));
  });
  it('quitado vale 0', () => {
    expect(loanOutstandingAt({ ...base, installmentsPaidBefore: 48, firstDueDate: '2020-01-10' }, '2026-11-30')).toBe(0);
  });
});

describe('CSV (R9)', () => {
  it('texto com ; aspas ou quebra de linha vai entre aspas', () => {
    expect(csvCell('Mercado; feira')).toBe('"Mercado; feira"');
    expect(csvCell('Disse "oi"')).toBe('"Disse ""oi"""');
    expect(csvCell('a\nb')).toBe('"a\nb"');
    expect(csvCell('Simples')).toBe('Simples');
  });
  it('critério 4: texto que começa com fórmula ganha apóstrofo', () => {
    expect(csvCell('=SOMA(A1)')).toBe("'=SOMA(A1)");
    expect(csvCell('+55 11')).toBe("'+55 11");
    expect(csvCell('-x')).toBe("'-x");
    expect(csvCell('@cmd')).toBe("'@cmd");
  });
  it('arquivo com BOM, ; e vírgula decimal; valores em centavos não ganham apóstrofo', () => {
    const csv = toCsv(['Descrição', 'Valor'], [['Salário', 500000], ['Mercado', -12345], ['Café', -5]]);
    expect(csv).toBe('﻿Descrição;Valor\r\nSalário;5000,00\r\nMercado;-123,45\r\nCafé;-0,05\r\n');
  });
});

describe('pdfSafe (R10)', () => {
  it('mantém acentos e o R$ com espaço não separável', () => {
    expect(pdfSafe('Alimentação R$ 1.234,56')).toBe('Alimentação R$ 1.234,56');
  });
  it('troca o sinal de menos e espaços finos; tira emojis', () => {
    expect(pdfSafe('−5%')).toBe('-5%');
    expect(pdfSafe('a b')).toBe('a b');
    expect(pdfSafe('Pizza 🍕 sexta')).toBe('Pizza  sexta');
  });
  it('compõe acentos decompostos (texto colado do macOS) em vez de perdê-los', () => {
    expect(pdfSafe('Cafe\u0301')).toBe('Café');
  });
  it('mantém as aspas e travessões do WinAnsi', () => {
    expect(pdfSafe('“ok” – fim…')).toBe('“ok” – fim…');
  });
});
