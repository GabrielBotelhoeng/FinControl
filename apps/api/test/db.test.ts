import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fromDateOnly, toDateOnly } from '../src/infra/date-mapping';
import { resetDb, testDb } from './helpers/db';

async function seedAccount() {
  const userId = randomUUID();
  await testDb.profile.create({ data: { id: userId, name: 'Ana' } });
  const account = await testDb.account.create({
    data: { userId, name: 'Corrente', type: 'checking', color: '#2563eb', initialBalance: 123456n },
  });
  return { userId, account };
}

describe('banco de dados', () => {
  beforeEach(resetDb);

  it('persiste centavos como BigInt e datas sem hora', async () => {
    const { userId, account } = await seedAccount();
    const tx = await testDb.transaction.create({
      data: { userId, type: 'expense', amount: 999n, description: 'Café', accountId: account.id, dueDate: fromDateOnly('2026-02-28') },
    });
    expect(account.initialBalance).toBe(123456n);
    expect(tx.amount).toBe(999n);
    expect(toDateOnly(tx.dueDate)).toBe('2026-02-28');
  });

  it('rejeita valor zero pela constraint', async () => {
    const { userId, account } = await seedAccount();
    await expect(
      testDb.transaction.create({
        data: { userId, type: 'expense', amount: 0n, description: 'X', accountId: account.id, dueDate: fromDateOnly('2026-01-01') },
      }),
    ).rejects.toThrow();
  });

  it('cartão de crédito sem limite/dias de fechamento é recusado pelo CHECK', async () => {
    const userId = randomUUID();
    await testDb.profile.create({ data: { id: userId, name: 'Ana' } });
    await expect(
      testDb.account.create({ data: { userId, name: 'Cartão', type: 'credit_card', color: '#7c3aed' } }),
    ).rejects.toThrow();
  });

  it('cartão de crédito com limite e dias válidos é aceito pelo CHECK', async () => {
    const userId = randomUUID();
    await testDb.profile.create({ data: { id: userId, name: 'Ana' } });
    const card = await testDb.account.create({
      data: { userId, name: 'Cartão', type: 'credit_card', color: '#7c3aed', creditLimit: 500000n, closingDay: 26, dueDay: 5 },
    });
    expect(card.creditLimit).toBe(500000n);
  });

  it('apaga tudo em cascata ao excluir o perfil', async () => {
    const { userId, account } = await seedAccount();
    await testDb.transaction.create({
      data: { userId, type: 'expense', amount: 10n, description: 'X', accountId: account.id, dueDate: fromDateOnly('2026-01-01') },
    });
    await testDb.profile.delete({ where: { id: userId } });
    expect(await testDb.account.count()).toBe(0);
    expect(await testDb.transaction.count()).toBe(0);
  });
});
