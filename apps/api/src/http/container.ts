import { createAccountsRepository } from '../modules/accounts/accounts.repository';
import { createAccountsService } from '../modules/accounts/accounts.service';
import { createCategoriesRepository } from '../modules/categories/categories.repository';
import { createCategoriesService } from '../modules/categories/categories.service';
import { createProfileRepository } from '../modules/profile/profile.repository';
import { createProfileService } from '../modules/profile/profile.service';
import { createProvisioner } from '../modules/profile/provisioning';
import type { AppDeps } from './deps';

export function buildContainer(deps: AppDeps) {
  const provisioner = createProvisioner(deps.db);
  const profile = createProfileService({ repo: createProfileRepository(deps.db), provisioner, authAdmin: deps.authAdmin });
  const accountsRepo = createAccountsRepository(deps.db);
  const accounts = createAccountsService(accountsRepo);
  const categoriesRepo = createCategoriesRepository(deps.db);
  const categories = createCategoriesService(categoriesRepo);
  return { provisioner, profile, accountsRepo, accounts, categoriesRepo, categories };
}

export type Container = ReturnType<typeof buildContainer>;
