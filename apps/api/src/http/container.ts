import { createAccountsRepository } from '../modules/accounts/accounts.repository';
import { createAccountsService } from '../modules/accounts/accounts.service';
import { createCardsRepository } from '../modules/cards/cards.repository';
import { createCardsService } from '../modules/cards/cards.service';
import { createCategoriesRepository } from '../modules/categories/categories.repository';
import { createCategoriesService } from '../modules/categories/categories.service';
import { createDashboardRepository } from '../modules/dashboard/dashboard.repository';
import { createDashboardService } from '../modules/dashboard/dashboard.service';
import { createDemoRepository } from '../modules/demo/demo.repository';
import { createDemoService } from '../modules/demo/demo.service';
import { createProfileRepository } from '../modules/profile/profile.repository';
import { createProfileService } from '../modules/profile/profile.service';
import { createProvisioner } from '../modules/profile/provisioning';
import { createRecurrencesRepository } from '../modules/recurrences/recurrences.repository';
import { createRecurrencesService } from '../modules/recurrences/recurrences.service';
import { createRefsValidator } from '../modules/transactions/transactions.refs';
import { createTransactionsRepository, type NewTransaction, type TransactionRow } from '../modules/transactions/transactions.repository';
import { createTransactionsService } from '../modules/transactions/transactions.service';
import type { AppDeps } from './deps';

export function buildContainer(deps: AppDeps) {
  const provisioner = createProvisioner(deps.db);
  const profile = createProfileService({ repo: createProfileRepository(deps.db), provisioner, authAdmin: deps.authAdmin });
  const accountsRepo = createAccountsRepository(deps.db);
  const accounts = createAccountsService({ repo: accountsRepo, clock: deps.clock });
  const categoriesRepo = createCategoriesRepository(deps.db);
  const categories = createCategoriesService(categoriesRepo);
  const transactionsRepo = createTransactionsRepository(deps.db);
  const validateRefs = createRefsValidator(accounts, categories);
  const recurrencesRepo = createRecurrencesRepository(deps.db);
  const recurrences = createRecurrencesService({ repo: recurrencesRepo, transactions: transactionsRepo, validateRefs, clock: deps.clock });
  const transactions = createTransactionsService({
    repo: transactionsRepo, validateRefs, recurrences, clock: deps.clock,
    // As N parcelas de uma compra no cartão são gravadas numa única transação do banco (decisão R10), no mesmo
    // estilo usado abaixo para o seed da demo: repositório recriado sobre o client da transação interativa.
    async createInstallments(userId: string, rows: NewTransaction[]): Promise<TransactionRow[]> {
      return deps.db.$transaction(async (tx) => {
        const scoped = createTransactionsRepository(tx);
        const created: TransactionRow[] = [];
        for (const row of rows) created.push(await scoped.create(userId, row));
        return created;
      });
    },
  });
  const dashboard = createDashboardService({ repo: createDashboardRepository(deps.db), transactions: transactionsRepo, recurrences, clock: deps.clock });
  const cardsRepo = createCardsRepository(deps.db);
  const cards = createCardsService({ repo: cardsRepo, accountsRepo, accounts, transactionsRepo, clock: deps.clock });
  const demo = createDemoService({
    repo: createDemoRepository(deps.db), categories: categoriesRepo, profile, clock: deps.clock,
    // O seed grava ~170 linhas; o limite de 5 s padrão do Prisma é apertado no plano gratuito.
    inTransaction: (fn) =>
      deps.db.$transaction(
        async (db) => {
          const transactionsTx = createTransactionsRepository(db);
          const recurrencesTx = createRecurrencesRepository(db);
          return fn({
            repo: createDemoRepository(db),
            accounts: createAccountsRepository(db),
            recurrencesRepo: recurrencesTx,
            transactions: transactionsTx,
            recurrences: createRecurrencesService({ repo: recurrencesTx, transactions: transactionsTx, validateRefs, clock: deps.clock }),
          });
        },
        { maxWait: 10_000, timeout: 30_000 },
      ),
  });
  return {
    provisioner, profile, accountsRepo, accounts, categoriesRepo, categories,
    transactionsRepo, validateRefs, recurrencesRepo, recurrences, transactions, dashboard, demo,
    cardsRepo, cards,
  };
}

export type Container = ReturnType<typeof buildContainer>;
