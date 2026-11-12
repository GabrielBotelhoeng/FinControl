import { endOfMonth, monthOf, todayInSaoPaulo, type CategoryType } from '@fincontrol/shared';
import { buildDemoData, type DemoAccountKey } from '../../domain/demo-data';
import { ForbiddenError } from '../../http/errors';
import type { AuthClaims } from '../../infra/token-verifier';
import type { AccountsRepository } from '../accounts/accounts.repository';
import type { CategoriesRepository } from '../categories/categories.repository';
import type { ProfileService } from '../profile/profile.service';
import type { RecurrencesRepository } from '../recurrences/recurrences.repository';
import type { RecurrencesService } from '../recurrences/recurrences.service';
import type { TransactionsRepository } from '../transactions/transactions.repository';
import type { DemoRepository } from './demo.repository';

const DEMO_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CLEANUP_BATCH = 500;

/** Tudo que o seed grava, ligado a uma única transação do banco. */
export type SeedScope = {
  repo: DemoRepository;
  accounts: AccountsRepository;
  recurrencesRepo: RecurrencesRepository;
  recurrences: RecurrencesService;
  transactions: TransactionsRepository;
};

export type DemoServiceDeps = {
  repo: DemoRepository;
  categories: CategoriesRepository;
  profile: ProfileService;
  clock: () => Date;
  /** Roda `fn` numa transação: ou o seed inteiro fica gravado, ou nada fica. */
  inTransaction: <T>(fn: (scope: SeedScope) => Promise<T>) => Promise<T>;
};

export function createDemoService(deps: DemoServiceDeps) {
  return {
    async seed(claims: AuthClaims): Promise<{ seeded: boolean }> {
      if (!claims.isAnonymous) throw new ForbiddenError('A demo está disponível apenas para visitantes sem cadastro.');
      const userId = claims.userId;
      if ((await deps.repo.countAccounts(userId)) > 0) return { seeded: false };
      // Leitura das categorias padrão fora da transação: elas já existem (criadas no provisionamento).
      const categories = await deps.categories.list(userId);

      // Atômico: quem recarrega no meio não vê dados pela metade, e uma falha não deixa a demo travada
      // (com contas gravadas, o guarda acima impediria gerar de novo).
      return deps.inTransaction(async (tx) => {
        // Sem o lock, seeds simultâneos (clique repetido, nova tentativa) passariam todos pela contagem.
        await tx.repo.lockSeed(userId);
        if ((await tx.repo.countAccounts(userId)) > 0) return { seeded: false };

        const today = todayInSaoPaulo(deps.clock());
        const plan = buildDemoData(today);

        const accountIds = new Map<DemoAccountKey, string>();
        for (const { key, ...data } of plan.accounts) accountIds.set(key, (await tx.accounts.create(userId, data)).id);
        const accountId = (key: DemoAccountKey): string => {
          const id = accountIds.get(key);
          if (!id) throw new Error(`Conta demo ausente: ${key}`);
          return id;
        };

        const categoryId = (name: string, type: CategoryType): string => {
          const found = categories.find((c) => c.name === name && c.type === type);
          if (!found) throw new Error(`Categoria padrão ausente: ${name}`);
          return found.id;
        };

        for (const r of plan.recurrences) {
          await tx.recurrencesRepo.create(userId, {
            frequency: 'monthly', startDate: r.startDate, endDate: null, type: r.type, amount: r.amount, description: r.description,
            accountId: accountId(r.accountKey), destinationAccountId: null, categoryId: categoryId(r.categoryName, r.type), nature: 'fixed',
          });
        }

        await tx.transactions.insertMany(
          userId,
          plan.transactions.map((t) => ({
            type: t.type,
            amount: t.amount,
            description: t.description,
            accountId: accountId(t.accountKey),
            destinationAccountId: t.destinationAccountKey ? accountId(t.destinationAccountKey) : null,
            categoryId: t.categoryName && t.type !== 'transfer' ? categoryId(t.categoryName, t.type) : null,
            nature: t.nature,
            status: t.status,
            dueDate: t.dueDate,
            paidDate: t.paidDate,
            recurrenceId: null,
            occurrenceDate: null,
            invoiceMonth: null,
            installmentNumber: null,
            installmentTotal: null,
          })),
        );

        await tx.recurrences.materialize(userId, endOfMonth(monthOf(today)));
        await tx.repo.markRecurringPaidBefore(userId, today, plan.overdueDescription);
        return { seeded: true };
      });
    },

    async cleanup(): Promise<{ deleted: number }> {
      const cutoff = new Date(deps.clock().getTime() - DEMO_TTL_MS);
      const ids = await deps.repo.staleDemoProfileIds(cutoff, CLEANUP_BATCH);
      for (const id of ids) await deps.profile.deleteAccount(id);
      return { deleted: ids.length };
    },
  };
}

export type DemoService = ReturnType<typeof createDemoService>;
