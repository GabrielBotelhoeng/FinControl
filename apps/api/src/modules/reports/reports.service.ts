import {
  changeRatio, endOfMonth, monthOf, reportPeriod, seriesMonths, startOfMonth, todayInSaoPaulo,
  type ReportCategoryDTO, type ReportDTO, type YearMonth,
} from '@fincontrol/shared';
import { savingsRate } from '../../domain/health';
import { UnprocessableError } from '../../http/errors';
import type { RecurrencesService } from '../recurrences/recurrences.service';
import { debtsAt, type DebtsReader } from './debts';
import { renderReportPdf } from './report-pdf';
import type { CsvRow, ReportsRepository } from './reports.repository';

const TOP_EXPENSES = 10;

export type ReportsServiceDeps = {
  repo: ReportsRepository;
  debts: DebtsReader;
  recurrences: Pick<RecurrencesService, 'materialize'>;
  clock: () => Date;
};

export function createReportsService(deps: ReportsServiceDeps) {
  const { repo } = deps;

  /** R1: o relatório vai só até o mês atual (depende de hoje, então fica aqui e não no schema). */
  function checkPeriod(from: YearMonth, to: YearMonth) {
    if (to > monthOf(todayInSaoPaulo(deps.clock()))) throw new UnprocessableError('O relatório vai só até o mês atual.');
    return reportPeriod(from, to);
  }

  async function categoryRows(userId: string, type: 'income' | 'expense', range: [string, string], previousRange: [string, string]): Promise<ReportCategoryDTO[]> {
    const [now, before] = await Promise.all([
      repo.totalsByCategory(userId, type, ...range),
      repo.totalsByCategory(userId, type, ...previousRange),
    ]);
    // R3: a categoria que só teve valor no período anterior entra com total 0, para a comparação mostrar a queda.
    const ids = [...new Set([...now.keys(), ...before.keys()])];
    const refs = await repo.categories(userId, ids);
    const sum = [...now.values()].reduce((a, b) => a + b, 0);
    return ids
      .flatMap((id) => {
        const c = refs.get(id);
        if (!c) return [];
        const total = now.get(id) ?? 0;
        const previous = before.get(id) ?? 0;
        return [{ categoryId: id, name: c.name, icon: c.icon, color: c.color, total, share: sum === 0 ? 0 : total / sum, previous, change: changeRatio(total, previous) }];
      })
      .sort((a, b) => b.total - a.total || b.previous - a.previous || a.name.localeCompare(b.name, 'pt-BR'));
  }

  async function build(userId: string, from: YearMonth, to: YearMonth): Promise<ReportDTO> {
    const period = checkPeriod(from, to);
    const range: [string, string] = [startOfMonth(from), endOfMonth(to)];
    const previousRange: [string, string] = [startOfMonth(period.previousFrom), endOfMonth(period.previousTo)];
    const series = seriesMonths(from, to);
    const balanceDate = endOfMonth(to);

    const [expenseByCategory, incomeByCategory, monthTotals, previousTotals, debtSources, topExpenses, balances] = await Promise.all([
      categoryRows(userId, 'expense', range, previousRange),
      categoryRows(userId, 'income', range, previousRange),
      repo.monthTotals(userId, startOfMonth(series[0]!), endOfMonth(to)),
      repo.monthTotals(userId, ...previousRange),
      deps.debts.load(userId),
      repo.topExpenses(userId, ...range, TOP_EXPENSES),
      repo.balances(userId, balanceDate),
    ]);

    const sumIn = (totals: Map<string, { income: number; expense: number }>, months: (m: string) => boolean) => {
      let income = 0;
      let expense = 0;
      for (const [m, t] of totals) {
        if (!months(m)) continue;
        income += t.income;
        expense += t.expense;
      }
      return { income, expense };
    };
    const current = sumIn(monthTotals, (m) => m >= from && m <= to);
    const previous = sumIn(previousTotals, () => true);

    return {
      period: { from, to, ...period },
      totals: {
        income: current.income,
        expense: current.expense,
        net: current.income - current.expense,
        savingsRate: savingsRate(current.income, current.expense),
        previousIncome: previous.income,
        previousExpense: previous.expense,
        incomeChange: changeRatio(current.income, previous.income),
        expenseChange: changeRatio(current.expense, previous.expense),
      },
      expenseByCategory,
      incomeByCategory,
      monthly: series.map((month) => {
        const t = monthTotals.get(month) ?? { income: 0, expense: 0 };
        return { month, income: t.income, expense: t.expense, net: t.income - t.expense };
      }),
      debts: series.map((month) => ({ month, ...debtsAt(debtSources, endOfMonth(month)) })),
      topExpenses,
      balances: { date: balanceDate, items: balances, total: balances.reduce((s, b) => s + b.balance, 0) },
    };
  }

  return {
    build,

    /** R10: o mesmo relatório da tela, em PDF. */
    async pdf(userId: string, from: YearMonth, to: YearMonth): Promise<Uint8Array> {
      return renderReportPdf(await build(userId, from, to), deps.clock());
    },

    /** R9: lançamentos do período, pagos e pendentes. As recorrências do período são materializadas antes. */
    async csvRows(userId: string, from: YearMonth, to: YearMonth): Promise<CsvRow[]> {
      checkPeriod(from, to);
      await deps.recurrences.materialize(userId, endOfMonth(to));
      return repo.csvRows(userId, startOfMonth(from), endOfMonth(to));
    },
  };
}

export type ReportsService = ReturnType<typeof createReportsService>;
