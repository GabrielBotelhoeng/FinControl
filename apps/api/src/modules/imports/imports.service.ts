import {
  normalizeDescription,
  type CategoryType, type ImportCommitDTO, type ImportCommitInput, type ImportPreviewDTO, type ImportPreviewInput,
} from '@fincontrol/shared';
import { NotFoundError, UnprocessableError } from '../../http/errors';
import { fromDateOnly, toDateOnly } from '../../infra/date-mapping';
import type { Db } from '../../infra/prisma';
import type { AccountsRepository } from '../accounts/accounts.repository';
import type { CategoriesRepository } from '../categories/categories.repository';

export type ImportsServiceDeps = { db: Db; accountsRepo: AccountsRepository; categoriesRepo: CategoriesRepository };

/** I5: palavras-chave comuns de extrato → categoria padrão (quando o histórico ainda não ensinou nada). */
const KEYWORDS: { type: CategoryType; category: string; words: string[] }[] = [
  { type: 'expense', category: 'Transporte', words: ['uber', ' 99 ', '99app', '99 pop', 'cabify', 'posto', 'combustivel', 'shell', 'ipiranga', 'estacionamento', 'metro', 'bilhete unico'] },
  { type: 'expense', category: 'Alimentação', words: ['ifood', 'rappi', 'mercado', 'supermercado', 'padaria', 'restaurante', 'lanchonete', 'acougue', 'hortifruti', 'atacadao', 'assai', 'carrefour', 'pao de acucar'] },
  { type: 'expense', category: 'Saúde', words: ['farmacia', 'drogaria', 'droga raia', 'drogasil', 'pague menos', 'hospital', 'clinica', 'laboratorio', 'unimed'] },
  { type: 'expense', category: 'Assinaturas', words: ['netflix', 'spotify', 'disney', 'prime video', 'amazon prime', 'youtube', 'hbo', 'max ', 'globoplay', 'deezer', 'icloud', 'google one'] },
  { type: 'expense', category: 'Moradia', words: ['aluguel', 'condominio', 'iptu'] },
  { type: 'expense', category: 'Contas', words: ['energia', 'enel', 'cemig', 'copel', 'light', 'sabesp', 'agua', 'internet', 'vivo', 'claro', 'tim ', 'oi '] },
  { type: 'expense', category: 'Educação', words: ['escola', 'faculdade', 'curso', 'udemy', 'alura', 'livraria'] },
  { type: 'expense', category: 'Compras', words: ['amazon', 'mercado livre', 'mercadolivre', 'shopee', 'magalu', 'americanas', 'shein', 'aliexpress'] },
  { type: 'income', category: 'Salário', words: ['salario', 'folha', 'pagamento de salario', 'proventos'] },
  { type: 'income', category: 'Rendimentos', words: ['rendimento', 'juros', 'dividendo', 'resgate'] },
];

const MAX_HISTORY = 3000;

export function createImportsService(deps: ImportsServiceDeps) {
  /** Só contas comuns: a compra no cartão tem fatura e parcelas, que o extrato não traz (I8). */
  async function assertImportable(userId: string, accountId: string) {
    const account = await deps.accountsRepo.findById(userId, accountId);
    if (!account) throw new NotFoundError('Conta');
    if (account.archivedAt) throw new UnprocessableError('Não é possível importar para uma conta arquivada.');
    if (account.type === 'credit_card') {
      throw new UnprocessableError('A importação é para contas (corrente, poupança, carteira). Compras no cartão entram pelo lançamento no cartão.');
    }
  }

  return {
    async preview(userId: string, input: ImportPreviewInput): Promise<ImportPreviewDTO> {
      await assertImportable(userId, input.accountId);
      const categories = await deps.categoriesRepo.list(userId);
      const byName = new Map(categories.map((c) => [`${c.type}|${c.name}`, c.id]));

      // I5: o lançamento mais recente com a mesma descrição ensina a categoria.
      const history = await deps.db.transaction.findMany({
        where: { userId, categoryId: { not: null }, type: { in: ['income', 'expense'] } },
        select: { description: true, categoryId: true, type: true },
        orderBy: { createdAt: 'desc' },
        take: MAX_HISTORY,
      });
      const learned = new Map<string, string>();
      for (const h of history) {
        const key = `${h.type}|${normalizeDescription(h.description)}`;
        if (!learned.has(key)) learned.set(key, h.categoryId!);
      }

      // I7: o que já existe na conta no período, contado por (dia, valor, tipo): duas linhas iguais no arquivo
      // e uma no banco marcam só a primeira como repetida.
      const dates = input.rows.map((r) => r.date).sort();
      const existing = await deps.db.transaction.findMany({
        where: {
          userId, accountId: input.accountId, type: { in: ['income', 'expense'] },
          OR: [
            { paidDate: { gte: fromDateOnly(dates[0]!), lte: fromDateOnly(dates.at(-1)!) } },
            { paidDate: null, dueDate: { gte: fromDateOnly(dates[0]!), lte: fromDateOnly(dates.at(-1)!) } },
          ],
        },
        select: { type: true, amount: true, paidDate: true, dueDate: true },
      });
      const seen = new Map<string, number>();
      for (const e of existing) {
        const key = `${toDateOnly(e.paidDate ?? e.dueDate)}|${Number(e.amount)}|${e.type}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }

      return {
        rows: input.rows.map((r) => {
          const type: CategoryType = r.amount < 0 ? 'expense' : 'income';
          const norm = normalizeDescription(r.description);
          const fromHistory = learned.get(`${type}|${norm}`);
          const padded = ` ${norm} `;
          // A palavra-chave precisa começar uma palavra: "oi" (operadora) não casa com "coisa".
          const rule = KEYWORDS.find((k) => k.type === type && k.words.some((w) => padded.includes(` ${w.trim()}`)));
          const fromKeyword = rule ? byName.get(`${type}|${rule.category}`) : undefined;
          const key = `${r.date}|${Math.abs(r.amount)}|${type}`;
          const dupCount = seen.get(key) ?? 0;
          if (dupCount > 0) seen.set(key, dupCount - 1);
          return {
            date: r.date, description: r.description, amount: Math.abs(r.amount), type,
            categoryId: fromHistory ?? fromKeyword ?? byName.get(`${type}|Outros`) ?? null,
            suggestion: fromHistory ? 'history' : fromKeyword ? 'keyword' : 'fallback',
            duplicate: dupCount > 0,
          } as const;
        }),
      };
    },

    /** I6: tudo numa transação só; cada linha vira um lançamento pago na data do extrato. */
    async commit(userId: string, input: ImportCommitInput): Promise<ImportCommitDTO> {
      await assertImportable(userId, input.accountId);
      const categories = new Map((await deps.categoriesRepo.list(userId)).map((c) => [c.id, c.type]));
      for (const r of input.rows) {
        const type = r.amount < 0 ? 'expense' : 'income';
        const catType = categories.get(r.categoryId);
        if (!catType) throw new NotFoundError('Categoria');
        if (catType !== type) {
          throw new UnprocessableError(`"${r.description}" é ${type === 'expense' ? 'uma saída' : 'uma entrada'}: escolha uma categoria de ${type === 'expense' ? 'despesa' : 'receita'}.`);
        }
      }
      const result = await deps.db.transaction.createMany({
        data: input.rows.map((r) => ({
          userId, accountId: input.accountId, type: r.amount < 0 ? ('expense' as const) : ('income' as const), amount: BigInt(Math.abs(r.amount)),
          description: r.description, categoryId: r.categoryId, nature: 'variable' as const, status: 'paid' as const,
          dueDate: fromDateOnly(r.date), paidDate: fromDateOnly(r.date),
        })),
      });
      return { created: result.count };
    },
  };
}

export type ImportsService = ReturnType<typeof createImportsService>;
