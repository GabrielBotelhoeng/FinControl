import { createPrisma } from '../../src/infra/prisma';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL ausente no ambiente de teste');

export const testDb = createPrisma(url);

export async function resetDb(): Promise<void> {
  await testDb.$executeRawUnsafe(
    'TRUNCATE "transactions", "loans", "bank_rates", "budgets", "goal_contributions", "goals", "recurrence_skips", "recurrences", "categories", "accounts", "profiles", "deleted_users" CASCADE',
  );
}
