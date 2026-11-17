import { addDays, addMonthsToYm, endOfMonth, monthOf, startOfMonth } from '@fincontrol/shared';
import { describe, expect, it } from 'vitest';
import { buildDemoData } from './demo-data';

const TODAY = '2026-11-11';

describe('buildDemoData', () => {
  it('inclui o financiamento do carro: 6 pagas antes do app, 6 pagas no histórico e 36 pendentes (D5)', () => {
    const plan = buildDemoData(TODAY);
    expect(plan.loans).toEqual([
      expect.objectContaining({
        key: 'vehicle', kind: 'vehicle', bankName: 'BCO DO BRASIL S.A.', bankCnpj8: '00000000', principal: 3000000,
        installmentAmount: 95000, installmentsTotal: 48, installmentsPaidBefore: 6, firstDueDate: '2025-12-01', accountKey: 'checking',
      }),
    ]);
    const installments = plan.transactions.filter((t) => t.loanKey === 'vehicle');
    expect(installments.map((t) => t.installmentNumber)).toEqual(Array.from({ length: 42 }, (_, i) => i + 7));
    const paid = installments.filter((t) => t.status === 'paid');
    expect(paid.map((t) => t.dueDate)).toEqual(['2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01']);
    expect(paid.every((t) => t.paidDate === t.dueDate && t.categoryName === 'Empréstimos e financiamentos')).toBe(true);
    expect(installments.find((t) => t.status === 'pending')!.dueDate).toBe('2026-12-01');
  });

  it('inclui 4 limites (Alimentação perto, Lazer estourado, Compras e Moradia dentro) e 3 metas (sub-projetos 3 e 5)', () => {
    const plan = buildDemoData(TODAY);
    const spent = (name: string) =>
      plan.transactions.filter((t) => t.type === 'expense' && t.categoryName === name && t.dueDate.startsWith('2026-11')).reduce((s, t) => s + t.amount, 0);
    const limit = (name: string) => plan.budgets.find((b) => b.categoryName === name)!.limit;
    expect(plan.budgets.map((b) => b.categoryName).sort()).toEqual(['Alimentação', 'Compras', 'Lazer', 'Moradia']);
    const foodPct = spent('Alimentação') / limit('Alimentação');
    expect(foodPct).toBeGreaterThanOrEqual(0.8);
    expect(foodPct).toBeLessThanOrEqual(1);
    expect(spent('Lazer') / limit('Lazer')).toBeGreaterThan(1);
    expect(plan.goals.map((g) => g.name)).toEqual(['Reserva de emergência', 'Viagem de férias', 'Notebook novo']);
    const notebook = plan.goals[2]!;
    expect(notebook.contributions.reduce((sum, c) => sum + c.amount, 0)).toBe(notebook.targetAmount);
    expect(plan.goals[0]!.contributions).toHaveLength(7);
    for (const g of plan.goals) for (const c of g.contributions) expect(c.date <= TODAY).toBe(true);
  });

  it('é determinístico para a mesma data', () => {
    expect(buildDemoData(TODAY)).toEqual(buildDemoData(TODAY));
  });

  it('mantém todas as datas entre 6 meses atrás e o fim do mês atual, e nada pago no futuro, fora da compra parcelada em andamento', () => {
    const plan = buildDemoData(TODAY);
    const min = startOfMonth(addMonthsToYm(monthOf(TODAY), -6));
    const max = endOfMonth(monthOf(TODAY));
    // A compra parcelada em andamento (decisão do controlador, Tarefa 9) tem parcelas com vencimento em meses
    // futuros por natureza (spec C1): já "pagas" do ponto de vista do cartão, mesmo com data além de hoje.
    // As parcelas pendentes do financiamento (Parte B) também vencem em meses futuros por natureza (spec C10).
    for (const t of plan.transactions.filter((t) => t.installmentGroupId === null && !t.loanKey)) {
      expect(t.dueDate >= min && t.dueDate <= max).toBe(true);
      if (t.status === 'paid') expect(t.paidDate! <= TODAY).toBe(true);
      expect(Number.isInteger(t.amount) && t.amount > 0).toBe(true);
    }
  });

  it('transferências vão da corrente para a poupança ou para o cartão, sem categoria', () => {
    const transfers = buildDemoData(TODAY).transactions.filter((t) => t.type === 'transfer');
    expect(transfers.length).toBeGreaterThan(0);
    for (const t of transfers) {
      expect(t.accountKey).toBe('checking');
      expect(['savings', 'card']).toContain(t.destinationAccountKey);
      expect(t.categoryName).toBeNull();
      expect(t.nature).toBeNull();
    }
    expect(transfers.some((t) => t.destinationAccountKey === 'card')).toBe(true);
  });

  it('inclui o cartão principal com limite, fechamento e vencimento (decisão do controlador)', () => {
    const plan = buildDemoData(TODAY);
    expect(plan.accounts).toContainEqual(
      expect.objectContaining({
        key: 'card', name: 'Cartão principal', type: 'credit_card',
        creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountKey: 'checking',
      }),
    );
  });

  it('a compra parcelada em andamento soma R$ 1.200 em 10 parcelas, com uma caindo na fatura do mês corrente', () => {
    const plan = buildDemoData(TODAY);
    const installments = plan.transactions.filter((t) => t.installmentGroupId !== null);
    expect(installments).toHaveLength(10);
    expect(installments.every((t) => t.installmentTotal === 10 && t.installmentGroupId === installments[0]!.installmentGroupId)).toBe(true);
    expect(installments.map((t) => t.installmentNumber).sort((a, b) => a! - b!)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
    expect(installments.reduce((sum, t) => sum + t.amount, 0)).toBe(120000);
    // É essa parcela que faz `health.debtCommitment > 0` (decisão R15): a fatura do mês corrente ainda não
    // vencida conta as parcelas que caem nela.
    expect(installments.some((t) => t.invoiceMonth === monthOf(TODAY))).toBe(true);
  });

  it('as faturas do cartão de M-6 a M-2 (e a de M-1, se já vencida) saem pagas da corrente para o cartão', () => {
    const plan = buildDemoData(TODAY);
    const payments = plan.transactions.filter((t) => t.type === 'transfer' && t.destinationAccountKey === 'card');
    expect(payments.length).toBeGreaterThanOrEqual(5);
    for (const p of payments) {
      expect(p.status).toBe('paid');
      expect(p.paidDate! <= TODAY).toBe(true);
      expect(p.amount).toBeGreaterThan(0);
    }
  });

  it('cada mês passado tem pelo menos 10 despesas variáveis', () => {
    const plan = buildDemoData(TODAY);
    for (let i = 1; i <= 6; i++) {
      const ym = addMonthsToYm(monthOf(TODAY), -i);
      const count = plan.transactions.filter((t) => t.type === 'expense' && t.nature === 'variable' && monthOf(t.dueDate) === ym).length;
      expect(count).toBeGreaterThanOrEqual(10);
    }
  });

  it('recorrências começam no primeiro mês do histórico', () => {
    const plan = buildDemoData(TODAY);
    expect(plan.recurrences.map((r) => r.description)).toEqual(['Salário', 'Aluguel', 'Internet', 'Streaming', 'Academia']);
    for (const r of plan.recurrences) expect(monthOf(r.startDate)).toBe('2026-05');
  });

  it('deixa pendentes o IPVA no fim do mês e a conta de luz em 2 dias (sub-projeto 5)', () => {
    const pending = buildDemoData(TODAY).transactions.filter((t) => t.status === 'pending' && !t.loanKey); // as parcelas do financiamento ficam de fora (Parte B)
    expect(pending).toEqual([
      expect.objectContaining({ description: 'IPVA (parcela)', dueDate: '2026-11-30' }),
      expect.objectContaining({ description: 'Conta de luz', dueDate: addDays(TODAY, 2), categoryName: 'Contas' }),
    ]);
  });
});
