import { createAnthropicClient } from '../infra/ai-client';
import { createBcbClient } from '../infra/bcb-client';
import { createAssistantRepository } from '../modules/assistant/assistant.repository';
import { createAssistantService } from '../modules/assistant/assistant.service';
import { createAssistantTools } from '../modules/assistant/assistant.tools';
import { createAccountsRepository } from '../modules/accounts/accounts.repository';
import { createAccountsService } from '../modules/accounts/accounts.service';
import { createBankRatesRepository } from '../modules/bank-rates/bank-rates.repository';
import { createBankRatesService } from '../modules/bank-rates/bank-rates.service';
import { createBudgetsRepository } from '../modules/budgets/budgets.repository';
import { createBudgetsService } from '../modules/budgets/budgets.service';
import { createCalendarService } from '../modules/calendar/calendar.service';
import { createCardsRepository } from '../modules/cards/cards.repository';
import { createCardsService } from '../modules/cards/cards.service';
import { createCategoriesRepository } from '../modules/categories/categories.repository';
import { createCategoriesService } from '../modules/categories/categories.service';
import { createDashboardRepository } from '../modules/dashboard/dashboard.repository';
import { createDashboardService } from '../modules/dashboard/dashboard.service';
import { createDemoRepository } from '../modules/demo/demo.repository';
import { createDebtsRepository, lastAnchor } from '../modules/debts/debts.repository';
import { createDebtsService } from '../modules/debts/debts.service';
import { createDemoService } from '../modules/demo/demo.service';
import { createGoalsRepository } from '../modules/goals/goals.repository';
import { createGoalsService } from '../modules/goals/goals.service';
import { createImportsService } from '../modules/imports/imports.service';
import { createRepeatedService } from '../modules/repeated/repeated.routes';
import { createLoansRepository } from '../modules/loans/loans.repository';
import { createLoansService } from '../modules/loans/loans.service';
import { createProfileRepository } from '../modules/profile/profile.repository';
import { createProfileService } from '../modules/profile/profile.service';
import { createProvisioner } from '../modules/profile/provisioning';
import { createWebPushSender } from '../infra/push-sender';
import { createPushRepository } from '../modules/push/push.repository';
import { createPushService } from '../modules/push/push.service';
import { createNotificationsRepository } from '../modules/notifications/notifications.repository';
import { createNotificationsService } from '../modules/notifications/notifications.service';
import { createDebtsReader } from '../modules/reports/debts';
import { createReportsRepository } from '../modules/reports/reports.repository';
import { createReportsService } from '../modules/reports/reports.service';
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
  const debtsRepo = createDebtsRepository(deps.db);
  const transactions = createTransactionsService({
    repo: transactionsRepo, validateRefs, recurrences, clock: deps.clock,
    withDebtLock: (userId, debtId, fn) =>
      debtsRepo.withLock(userId, debtId, (tx, data) => {
        const anchor = lastAnchor(data.events);
        return fn(anchor ? { date: anchor.date, recordedAt: anchor.recordedAt } : null, createTransactionsRepository(tx));
      }),
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
  const bankRates = createBankRatesService({
    repo: createBankRatesRepository(deps.db), bcb: createBcbClient(deps.fetchFn ?? fetch), logger: deps.logger,
  });
  const budgets = createBudgetsService({ repo: createBudgetsRepository(deps.db), categoriesRepo, recurrences, clock: deps.clock });
  const goalsRepo = createGoalsRepository(deps.db);
  const goals = createGoalsService({ repo: goalsRepo, clock: deps.clock });
  const loansRepo = createLoansRepository(deps.db);
  const loans = createLoansService({ repo: loansRepo, accountsRepo, categoriesRepo, bankRates });
  const cardsRepo = createCardsRepository(deps.db);
  const cards = createCardsService({ repo: cardsRepo, accountsRepo, accounts, transactionsRepo, clock: deps.clock });
  const calendar = createCalendarService({ db: deps.db, accountsRepo, cards, recurrences, clock: deps.clock });
  const imports = createImportsService({ db: deps.db, accountsRepo, categoriesRepo });
  const repeated = createRepeatedService({ db: deps.db, clock: deps.clock });
  const debtsReader = createDebtsReader(deps.db);
  const debts = createDebtsService({ repo: debtsRepo, accountsRepo, categoriesRepo, clock: deps.clock });
  const dashboardRepo = createDashboardRepository(deps.db);
  const dashboard = createDashboardService({
    repo: dashboardRepo, transactions: transactionsRepo, recurrences, accountsRepo, cards, loansRepo, budgets, debts: debtsReader, clock: deps.clock,
  });
  const notifications = createNotificationsService({
    repo: createNotificationsRepository(deps.db), profileRepo: createProfileRepository(deps.db), recurrences,
    cards: { accountsRepo, cards, installmentTotalsByAccount: dashboardRepo.installmentTotalsByAccount }, budgets, goals, logger: deps.logger, clock: deps.clock,
  });
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = deps.config;
  const vapid = VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT ? { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY, subject: VAPID_SUBJECT } : null;
  const push = createPushService({
    repo: createPushRepository(deps.db), notifications, logger: deps.logger, clock: deps.clock,
    sender: vapid ? (deps.pushSender ?? createWebPushSender(vapid, deps.logger)) : null, publicKey: vapid?.publicKey ?? null,
  });
  const reports = createReportsService({ repo: createReportsRepository(deps.db), debts: debtsReader, recurrences, clock: deps.clock });
  const { ANTHROPIC_API_KEY, AI_MODEL, AI_ALLOWED_EMAILS } = deps.config;
  const assistant = createAssistantService({
    ai: deps.aiClient ?? (ANTHROPIC_API_KEY ? createAnthropicClient({ apiKey: ANTHROPIC_API_KEY, model: AI_MODEL, logger: deps.logger }) : null),
    allowedEmails: AI_ALLOWED_EMAILS, usage: createAssistantRepository(deps.db),
    tools: createAssistantTools({ reports, transactions, categoriesRepo, budgets, goals, accounts, dashboard, debts, clock: deps.clock }),
    profileRepo: createProfileRepository(deps.db), categoriesRepo, logger: deps.logger, clock: deps.clock,
  });
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
    cardsRepo, cards, bankRates, loansRepo, loans, budgets, goalsRepo, goals, debtsReader, debts, calendar, imports, repeated, reports, notifications, push, assistant,
  };
}

export type Container = ReturnType<typeof buildContainer>;
