import { createAccountsRepository } from '../modules/accounts/accounts.repository';
import { createAccountsService } from '../modules/accounts/accounts.service';
import { createCategoriesRepository } from '../modules/categories/categories.repository';
import { createCategoriesService } from '../modules/categories/categories.service';
import { createDashboardRepository } from '../modules/dashboard/dashboard.repository';
import { createDashboardService } from '../modules/dashboard/dashboard.service';
import { createProfileRepository } from '../modules/profile/profile.repository';
import { createProfileService } from '../modules/profile/profile.service';
import { createProvisioner } from '../modules/profile/provisioning';
import { createRecurrencesRepository } from '../modules/recurrences/recurrences.repository';
import { createRecurrencesService } from '../modules/recurrences/recurrences.service';
import { createRefsValidator } from '../modules/transactions/transactions.refs';
import { createTransactionsRepository } from '../modules/transactions/transactions.repository';
import { createTransactionsService } from '../modules/transactions/transactions.service';
import type { AppDeps } from './deps';

export function buildContainer(deps: AppDeps) {
  const provisioner = createProvisioner(deps.db);
  const profile = createProfileService({ repo: createProfileRepository(deps.db), provisioner, authAdmin: deps.authAdmin });
  const accountsRepo = createAccountsRepository(deps.db);
  const accounts = createAccountsService(accountsRepo);
  const categoriesRepo = createCategoriesRepository(deps.db);
  const categories = createCategoriesService(categoriesRepo);
  const transactionsRepo = createTransactionsRepository(deps.db);
  const validateRefs = createRefsValidator(accounts, categories);
  const recurrencesRepo = createRecurrencesRepository(deps.db);
  const recurrences = createRecurrencesService({ repo: recurrencesRepo, transactions: transactionsRepo, validateRefs, clock: deps.clock });
  const transactions = createTransactionsService({ repo: transactionsRepo, validateRefs, recurrences, clock: deps.clock });
  const dashboard = createDashboardService({ repo: createDashboardRepository(deps.db), transactions: transactionsRepo, recurrences, clock: deps.clock });
  return {
    provisioner, profile, accountsRepo, accounts, categoriesRepo, categories,
    transactionsRepo, validateRefs, recurrencesRepo, recurrences, transactions, dashboard,
  };
}

export type Container = ReturnType<typeof buildContainer>;
