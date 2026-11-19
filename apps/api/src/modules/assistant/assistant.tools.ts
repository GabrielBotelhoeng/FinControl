import {
  addMonthsToYm, ASSET_KIND_LABELS, dateOnlySchema, DEBT_KIND_LABELS, DEBT_STATUS_LABELS, endOfMonth, monthOf, startOfMonth, todayInSaoPaulo, yearMonthSchema,
  type GoalStatus, type ListTransactionsQuery, type TransactionDTO, type TransactionStatus, type TransactionType,
} from '@fincontrol/shared';
import { z } from 'zod';
import type { AiTool } from '../../infra/ai-client';
import type { AccountsService } from '../accounts/accounts.service';
import type { AssetsService } from '../assets/assets.service';
import type { BudgetsService } from '../budgets/budgets.service';
import type { CategoriesRepository } from '../categories/categories.repository';
import type { DashboardService } from '../dashboard/dashboard.service';
import type { DebtsService } from '../debts/debts.service';
import type { GoalsService } from '../goals/goals.service';
import type { ReportsService } from '../reports/reports.service';
import type { TransactionsService } from '../transactions/transactions.service';

// Ferramentas só de leitura do assistente (spec A7, A10). Saída enxuta, em reais e sem ids (A8).

export type AssistantToolsDeps = {
  reports: Pick<ReportsService, 'build'>;
  transactions: Pick<TransactionsService, 'list'>;
  categoriesRepo: Pick<CategoriesRepository, 'list'>;
  budgets: Pick<BudgetsService, 'getMonth'>;
  goals: Pick<GoalsService, 'list'>;
  accounts: Pick<AccountsService, 'list'>;
  dashboard: Pick<DashboardService, 'summary'>;
  debts: Pick<DebtsService, 'list'>;
  assets: Pick<AssetsService, 'list'>;
  clock: () => Date;
};

/** Erro que volta para o modelo como `tool_result` com `is_error`, para ele corrigir o pedido. */
export class ToolInputError extends Error {}

/** Centavos → reais com 2 casas. */
export const reais = (cents: number) => Math.round(cents) / 100;
const pct = (fraction: number | null) => (fraction === null ? null : Math.round(fraction * 1000) / 10);

const TYPE_LABEL: Record<TransactionType, string> = { expense: 'despesa', income: 'receita', transfer: 'transferência' };
const STATUS_LABEL: Record<TransactionStatus, string> = { paid: 'pago', pending: 'pendente' };
const GOAL_LABEL: Record<GoalStatus, string> = { reached: 'concluída', on_track: 'no ritmo', late: 'atrasada', overdue: 'prazo vencido' };

/** Compara nomes sem maiúsculas nem acentos ("Alimentação" = "alimentacao"). */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

const SEARCH_PAGE = 100;
const SEARCH_MAX_PAGES = 5;
const SEARCH_ITEMS = 20;

const periodSchema = z.object({ de: yearMonthSchema, ate: yearMonthSchema });
const searchSchema = z.object({
  texto: z.string().trim().min(1).max(100).optional(),
  categoria: z.string().trim().min(1).max(80).optional(),
  de: dateOnlySchema.optional(),
  ate: dateOnlySchema.optional(),
  tipo: z.enum(['despesa', 'receita']).optional(),
});
const monthSchema = z.object({ mes: yearMonthSchema.optional() });

export const TOOL_DEFINITIONS: AiTool[] = [
  {
    name: 'resumo_periodo',
    description: 'Receitas, despesas, saldo e totais por categoria de um período de meses, comparados com o período anterior de mesmo tamanho. Vai só até o mês atual.',
    input_schema: {
      type: 'object',
      properties: { de: { type: 'string', description: 'Mês inicial AAAA-MM' }, ate: { type: 'string', description: 'Mês final AAAA-MM' } },
      required: ['de', 'ate'],
    },
  },
  {
    name: 'buscar_lancamentos',
    description: 'Busca lançamentos (pagos e pendentes) por texto da descrição, categoria, datas e tipo. Devolve quantidade, total e os 20 mais recentes. Sem datas, olha os últimos 3 meses.',
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'Trecho da descrição, ex.: "cerveja"' },
        categoria: { type: 'string', description: 'Nome exato de uma categoria da pessoa' },
        de: { type: 'string', description: 'Data inicial AAAA-MM-DD' },
        ate: { type: 'string', description: 'Data final AAAA-MM-DD' },
        tipo: { type: 'string', enum: ['despesa', 'receita'] },
      },
    },
  },
  {
    name: 'orcamento_mes',
    description: 'Limites de gasto por categoria no mês, quanto já foi comprometido e a situação, além da sobra planejada.',
    input_schema: { type: 'object', properties: { mes: { type: 'string', description: 'AAAA-MM; padrão: mês atual' } } },
  },
  {
    name: 'metas',
    description: 'Metas de economia: alvo, guardado, prazo, situação e aporte mensal necessário.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'saldos_e_dividas',
    description:
      'Saldo atual de cada conta, saldo total, previsão para o fim do mês, dívidas (cartão, empréstimo e com credores, cada uma com saldo, juros e multas e situação), contas vencidas ou a pagar, bens (imóvel, veículo, investimento fora das contas) e o patrimônio líquido (contas sem cartão + bens − dívidas).',
    input_schema: { type: 'object', properties: {} },
  },
];

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input ?? {});
  if (!parsed.success) throw new ToolInputError(parsed.error.issues.map((i) => `${i.path.join('.') || 'entrada'}: ${i.message}`).join('; '));
  return parsed.data;
}

export function createAssistantTools(deps: AssistantToolsDeps) {
  const currentMonth = () => monthOf(todayInSaoPaulo(deps.clock()));

  async function resumoPeriodo(userId: string, input: unknown) {
    const { de, ate: asked } = parseInput(periodSchema, input);
    // O relatório vai só até o mês atual: um "até" no futuro vira o mês atual em vez de erro.
    const ate = asked > currentMonth() ? currentMonth() : asked;
    if (de > ate) throw new ToolInputError('O mês inicial vem depois do final (ou está no futuro).');
    let report;
    try {
      report = await deps.reports.build(userId, de, ate);
    } catch (err) {
      if (err instanceof RangeError) throw new ToolInputError(err.message);
      throw err;
    }
    const t = report.totals;
    return {
      periodo: { de, ate, anterior: `${report.period.previousFrom} a ${report.period.previousTo}` },
      receitas: reais(t.income),
      despesas: reais(t.expense),
      saldo: reais(t.net),
      poupanca_pct: pct(t.savingsRate),
      anterior: { receitas: reais(t.previousIncome), despesas: reais(t.previousExpense) },
      despesas_por_categoria: report.expenseByCategory.slice(0, 10).map((c) => ({ categoria: c.name, total: reais(c.total), anterior: reais(c.previous) })),
      receitas_por_categoria: report.incomeByCategory.slice(0, 5).map((c) => ({ categoria: c.name, total: reais(c.total) })),
    };
  }

  async function buscarLancamentos(userId: string, input: unknown) {
    const f = parseInput(searchSchema, input);
    const month = currentMonth();
    // Sem início, 3 meses até o fim (ou até hoje): "só até janeiro" olha novembro a janeiro, sem dar erro.
    const to = f.ate ?? endOfMonth(month);
    const from = f.de ?? startOfMonth(addMonthsToYm(monthOf(to), -2));
    if (from > to) throw new ToolInputError('A data inicial vem depois da final.');
    const categories = await deps.categoriesRepo.list(userId);
    const names = new Map(categories.map((c) => [c.id, c.name]));
    let categoryId: string | undefined;
    if (f.categoria) {
      const type = f.tipo === 'despesa' ? 'expense' : f.tipo === 'receita' ? 'income' : undefined;
      const found = categories.filter((c) => fold(c.name) === fold(f.categoria!) && (!type || c.type === type));
      if (found.length === 0) throw new ToolInputError(`Categoria não encontrada. As categorias são: ${[...new Set(categories.map((c) => c.name))].join(', ')}.`);
      // "Outros" existe como despesa e como receita: sem o tipo, não dá para saber qual.
      if (found.length > 1) throw new ToolInputError(`Há uma categoria "${found[0]!.name}" de despesa e outra de receita. Informe o tipo.`);
      categoryId = found[0]!.id;
    }
    const query: ListTransactionsQuery = {
      from, to, limit: SEARCH_PAGE,
      ...(f.texto ? { q: f.texto } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(f.tipo ? { type: f.tipo === 'despesa' ? 'expense' : 'income' } : {}),
    };
    const items: TransactionDTO[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < SEARCH_MAX_PAGES; page += 1) {
      const result = await deps.transactions.list(userId, { ...query, ...(cursor ? { cursor } : {}) });
      items.push(...result.items);
      cursor = result.nextCursor;
      if (!cursor) break;
    }
    const sum = (type: TransactionType) => reais(items.filter((i) => i.type === type).reduce((s, i) => s + i.amount, 0));
    return {
      periodo: { de: from, ate: to },
      quantidade: items.length,
      ...(cursor ? { aviso: `Há mais de ${items.length} lançamentos; os totais contam só os ${items.length} mais recentes. Refine a busca.` } : {}),
      total_despesas: sum('expense'),
      total_receitas: sum('income'),
      lancamentos: items.slice(0, SEARCH_ITEMS).map((i) => ({
        data: i.dueDate,
        descricao: i.description,
        valor: reais(i.amount),
        tipo: TYPE_LABEL[i.type],
        categoria: i.categoryId ? (names.get(i.categoryId) ?? null) : null,
        situacao: STATUS_LABEL[i.status],
      })),
    };
  }

  async function orcamentoMes(userId: string, input: unknown) {
    const { mes } = parseInput(monthSchema, input);
    const b = await deps.budgets.getMonth(userId, mes);
    const status = { ok: 'dentro', near: 'perto do limite', over: 'estourou' } as const;
    return {
      mes: b.month,
      limite_total: reais(b.totals.limit),
      comprometido_total: reais(b.totals.committed),
      sobra_planejada: reais(b.plannedLeftover),
      categorias: b.items.map((i) => ({ categoria: i.name, limite: reais(i.limit), comprometido: reais(i.committed), situacao: status[i.status] })),
      sem_limite: b.categoriesWithoutBudget.map((c) => c.name),
    };
  }

  async function metas(userId: string) {
    const goals = await deps.goals.list(userId);
    return goals.map((g) => ({
      meta: g.name, alvo: reais(g.targetAmount), guardado: reais(g.saved), prazo: g.targetDate,
      situacao: GOAL_LABEL[g.status], aporte_mensal_necessario: reais(g.monthlyNeeded),
    }));
  }

  async function saldosEDividas(userId: string) {
    const [accounts, summary, debts, assets] = await Promise.all([
      deps.accounts.list(userId, false), deps.dashboard.summary(userId), deps.debts.list(userId), deps.assets.list(userId),
    ]);
    const typeLabel: Record<string, string> = { checking: 'conta corrente', savings: 'poupança', wallet: 'carteira', investment: 'investimento', credit_card: 'cartão de crédito' };
    return {
      contas: accounts.map((a) => ({
        conta: a.name,
        tipo: typeLabel[a.type] ?? a.type,
        saldo: reais(a.balance),
        ...(a.card ? { limite_disponivel: reais(a.card.limitAvailable), fatura_aberta: a.card.openInvoice ? reais(a.card.openInvoice.amount) : 0 } : {}),
      })),
      saldo_total: reais(summary.totalBalance),
      previsao_fim_do_mes: reais(summary.forecastEndOfMonth),
      dividas: {
        cartoes: reais(summary.debts.cards), emprestimos: reais(summary.debts.loans), com_credores: reais(summary.debts.others), total: reais(summary.debts.total),
      },
      // V11: cada dívida com credor, para a IA sugerir a ordem de quitação. Quitadas ficam de fora (contexto enxuto).
      dividas_com_credores: debts
        .filter((d) => d.status !== 'paid_off')
        .map((d) => ({
          divida: d.name, credor: d.creditor, tipo: DEBT_KIND_LABELS[d.kind], situacao: DEBT_STATUS_LABELS[d.status], saldo: reais(d.balance),
          juros_e_multas: reais(d.interest), pago: reais(d.paid), ...(d.nextDue ? { proxima_parcela: { vencimento: d.nextDue.date, valor: reais(d.nextDue.amount) } } : {}),
        })),
      contas_vencidas: summary.overdueCount,
      contas_a_pagar_no_mes: summary.pendingCount,
      // B12 do sub-projeto 11: os vendidos (valor 0) ficam de fora, como as dívidas quitadas.
      patrimonio_liquido: reais(summary.netWorth),
      bens: assets.filter((a) => a.value > 0).map((a) => ({ bem: a.name, tipo: ASSET_KIND_LABELS[a.kind], valor: reais(a.value) })),
    };
  }

  return {
    definitions: TOOL_DEFINITIONS,
    async run(userId: string, name: string, input: unknown): Promise<unknown> {
      switch (name) {
        case 'resumo_periodo': return resumoPeriodo(userId, input);
        case 'buscar_lancamentos': return buscarLancamentos(userId, input);
        case 'orcamento_mes': return orcamentoMes(userId, input);
        case 'metas': return metas(userId);
        case 'saldos_e_dividas': return saldosEDividas(userId);
        default: throw new ToolInputError(`Ferramenta desconhecida: ${name}`);
      }
    },
  };
}

export type AssistantTools = ReturnType<typeof createAssistantTools>;
