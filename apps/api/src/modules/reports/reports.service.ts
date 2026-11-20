import {
  addMonthsToYm, changeRatio, compareTags, endOfMonth, monthOf, reportPeriod, seriesMonths, startOfMonth, todayInSaoPaulo,
  type ReportCategoryDTO, type ReportDTO, type ReportSubcategoryDTO, type ReportTagDTO, type YearMonth,
} from '@fincontrol/shared';
import { savingsRate } from '../../domain/health';
import { UnprocessableError } from '../../http/errors';
import { foldIntoParents } from '../categories/rollup';
import type { RecurrencesService } from '../recurrences/recurrences.service';
import { debtsAt, type DebtsReader } from './debts';
import { aboveAverage, byDescription, byWeekday, fixedVsVariable, smallExpenses } from './report-analysis';
import { renderReportPdf } from './report-pdf';
import { renderReportXlsx } from './report-xlsx';
import type { CsvRow, ReportsRepository } from './reports.repository';

const TOP_EXPENSES = 10;

type TagTotals = Awaited<ReturnType<ReportsRepository['totalsByTag']>>;

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

  const detail = (categoryId: string | null, name: string, total: number, previous: number): ReportSubcategoryDTO =>
    ({ categoryId, name, total, previous, change: changeRatio(total, previous) });

  /**
   * Por categoria principal, com as subcategorias somadas nela (sub-projeto 15, U5) e o detalhe delas (U7). R3: a
   * categoria que só teve valor no período anterior entra com total 0, para a comparação mostrar a queda.
   */
  async function categoryRows(
    userId: string, type: 'income' | 'expense', range: [string, string], previousRange: [string, string], parents: Map<string, string>,
  ): Promise<ReportCategoryDTO[]> {
    const [now, before] = await Promise.all([
      repo.totalsByCategory(userId, type, ...range),
      repo.totalsByCategory(userId, type, ...previousRange),
    ]);
    const leaves = [...new Set([...now.keys(), ...before.keys()])];
    const rootOf = (id: string) => parents.get(id) ?? id;
    const roots = [...new Set(leaves.map(rootOf))];
    const refs = await repo.categories(userId, [...new Set([...roots, ...leaves])]);
    const add = (a: number, b: number) => a + b;
    const nowRoot = foldIntoParents(now, parents, add);
    const beforeRoot = foldIntoParents(before, parents, add);
    const sum = [...nowRoot.values()].reduce(add, 0);
    const byValue = (a: ReportSubcategoryDTO, b: ReportSubcategoryDTO) => b.total - a.total || b.previous - a.previous || a.name.localeCompare(b.name, 'pt-BR');
    return roots
      .flatMap((id) => {
        const c = refs.get(id);
        if (!c) return [];
        const total = nowRoot.get(id) ?? 0;
        const previous = beforeRoot.get(id) ?? 0;
        // U7: só quando alguma subcategoria teve valor; o lançado direto na categoria vem por último.
        const children = leaves
          .filter((leaf) => parents.get(leaf) === id && refs.has(leaf))
          .map((leaf) => detail(leaf, refs.get(leaf)!.name, now.get(leaf) ?? 0, before.get(leaf) ?? 0))
          .sort(byValue);
        const direct = (now.get(id) ?? 0) + (before.get(id) ?? 0) > 0 ? [detail(null, 'Sem subcategoria', now.get(id) ?? 0, before.get(id) ?? 0)] : [];
        const subcategories = children.length > 0 ? [...children, ...direct] : [];
        return [{ categoryId: id, name: c.name, icon: c.icon, color: c.color, total, share: sum === 0 ? 0 : total / sum, previous, change: changeRatio(total, previous), subcategories }];
      })
      .sort((a, b) => b.total - a.total || b.previous - a.previous || a.name.localeCompare(b.name, 'pt-BR'));
  }

  /**
   * H1–H3 (sub-projeto 14): as tags com despesa paga no período ou no anterior (a que só existiu antes entra com 0),
   * do maior total para o menor. A participação é sobre o total de despesas do período.
   */
  function tagRows(now: TagTotals, before: TagTotals, expense: number): ReportTagDTO[] {
    return [...new Set([...now.keys(), ...before.keys()])]
      .map((name) => {
        const total = now.get(name)?.total ?? 0;
        const previous = before.get(name)?.total ?? 0;
        return { name, total, count: now.get(name)?.count ?? 0, share: expense === 0 ? 0 : total / expense, previous, change: changeRatio(total, previous) };
      })
      .sort((a, b) => b.total - a.total || b.previous - a.previous || compareTags(a.name, b.name));
  }

  async function csvRows(userId: string, from: YearMonth, to: YearMonth): Promise<CsvRow[]> {
    checkPeriod(from, to);
    await deps.recurrences.materialize(userId, endOfMonth(to));
    return repo.csvRows(userId, startOfMonth(from), endOfMonth(to));
  }

  async function build(userId: string, from: YearMonth, to: YearMonth): Promise<ReportDTO> {
    const period = checkPeriod(from, to);
    const range: [string, string] = [startOfMonth(from), endOfMonth(to)];
    const previousRange: [string, string] = [startOfMonth(period.previousFrom), endOfMonth(period.previousTo)];
    const series = seriesMonths(from, to);
    const balanceDate = endOfMonth(to);

    const parents = await repo.subcategoryParents(userId);
    const [expenseByCategory, incomeByCategory, monthTotals, previousTotals, debtSources, topExpenses, balances, tagsNow, tagsBefore] = await Promise.all([
      categoryRows(userId, 'expense', range, previousRange, parents),
      categoryRows(userId, 'income', range, previousRange, parents),
      repo.monthTotals(userId, startOfMonth(series[0]!), endOfMonth(to)),
      repo.monthTotals(userId, ...previousRange),
      deps.debts.load(userId),
      repo.topExpenses(userId, ...range, TOP_EXPENSES),
      repo.balances(userId, balanceDate),
      repo.totalsByTag(userId, ...range),
      repo.totalsByTag(userId, ...previousRange),
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
      expenseByTag: tagRows(tagsNow, tagsBefore, current.expense),
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
    csvRows,

    /** Planilha de análise (spec da exportação em Excel): o relatório, os lançamentos e as análises E5–E9. */
    async xlsx(userId: string, from: YearMonth, to: YearMonth): Promise<Buffer> {
      const report = await build(userId, from, to);
      const { months } = report.period;
      const before3: [string, string] = [startOfMonth(addMonthsToYm(from, -3)), endOfMonth(addMonthsToYm(from, -1))];
      const [rows, previousLeaves, parents, yoyNow, yoyBefore] = await Promise.all([
        csvRows(userId, from, to),
        repo.totalsByCategory(userId, 'expense', ...before3),
        repo.subcategoryParents(userId),
        months <= 12 ? repo.monthTotals(userId, startOfMonth(from), endOfMonth(to)) : null,
        months <= 12 ? repo.monthTotals(userId, startOfMonth(addMonthsToYm(from, -12)), endOfMonth(addMonthsToYm(to, -12))) : null,
      ]);
      // Sub-projeto 15 (U5): "antes × agora" compara categorias principais, com as subcategorias somadas nelas.
      const previousIds = foldIntoParents(previousLeaves, parents, (a, b) => a + b);
      const refs = await repo.categories(userId, [...previousIds.keys()]);
      const previous3 = new Map([...previousIds].flatMap(([id, total]) => (refs.get(id) ? [[refs.get(id)!.name, total] as const] : [])));
      const current = new Map(report.expenseByCategory.filter((c) => c.total > 0).map((c) => [c.name, c.total]));
      const expenses = rows
        .filter((r) => r.type === 'expense' && r.status === 'paid')
        .map((r) => ({ description: r.description, amount: r.amount, date: r.date, category: r.category ?? 'Sem categoria', nature: r.nature }));
      const yearOverYear =
        yoyNow && yoyBefore
          ? Array.from({ length: months }, (_, i) => {
              const month = addMonthsToYm(from, i);
              const now = yoyNow.get(month) ?? { income: 0, expense: 0 };
              const before = yoyBefore.get(addMonthsToYm(month, -12)) ?? { income: 0, expense: 0 };
              return { month, income: now.income, expense: now.expense, previousIncome: before.income, previousExpense: before.expense };
            })
          : null;
      return renderReportXlsx(
        {
          report, rows, yearOverYear,
          descriptions: byDescription(expenses),
          weekdays: byWeekday(expenses, startOfMonth(from), endOfMonth(to)),
          small: smallExpenses(expenses, months),
          natures: fixedVsVariable(expenses),
          average: aboveAverage(current, previous3, months),
        },
        deps.clock(),
      );
    },
  };
}

export type ReportsService = ReturnType<typeof createReportsService>;
