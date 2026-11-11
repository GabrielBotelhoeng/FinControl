import { transactionShapeIssues, type ShapeInput } from '@fincontrol/shared';
import { ValidationError } from '../../http/errors';
import type { AccountsService } from '../accounts/accounts.service';
import type { CategoriesService } from '../categories/categories.service';

export type RefsCheck = { account?: boolean; destination?: boolean; category?: boolean };
export type ValidateRefs = (userId: string, t: ShapeInput, check?: RefsCheck) => Promise<void>;

/** Valida a forma e se as contas e a categoria pertencem ao usuário. Só checa o que mudou (check). */
export function createRefsValidator(accounts: AccountsService, categories: CategoriesService): ValidateRefs {
  return async (userId, t, check = { account: true, destination: true, category: true }) => {
    const issues = transactionShapeIssues(t);
    if (issues.length > 0) throw new ValidationError(issues);
    if (check.account) await accounts.assertUsable(userId, t.accountId);
    if (check.destination && t.destinationAccountId) await accounts.assertUsable(userId, t.destinationAccountId);
    if (check.category && t.categoryId && t.type !== 'transfer') await categories.assertMatches(userId, t.categoryId, t.type);
  };
}
