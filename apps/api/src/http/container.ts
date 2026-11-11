import { createAccountsRepository } from '../modules/accounts/accounts.repository';
import { createAccountsService } from '../modules/accounts/accounts.service';
import { createCategoriesRepository } from '../modules/categories/categories.repository';
import { createCategoriesService } from '../modules/categories/categories.service';
import { createProfileRepository } from '../modules/profile/profile.repository';
import { createProfileService } from '../modules/profile/profile.service';
import { createProvisioner } from '../modules/profile/provisioning';
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
  const transactions = createTransactionsService({ repo: transactionsRepo, validateRefs, clock: deps.clock });
  return { provisioner, profile, accountsRepo, accounts, categoriesRepo, categories, transactionsRepo, validateRefs, transactions };
}

export type Container = ReturnType<typeof buildContainer>;
