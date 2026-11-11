import type { AccountDTO, CreateAccountInput, UpdateAccountInput } from '@fincontrol/shared';
import { computeBalance, ZERO_FLOWS, type AccountFlows } from '../../domain/balance';
import { ConflictError, NotFoundError, UnprocessableError } from '../../http/errors';
import type { AccountRow, AccountsRepository } from './accounts.repository';

const toDTO = (a: AccountRow, flows: AccountFlows = ZERO_FLOWS): AccountDTO => ({
  id: a.id,
  name: a.name,
  type: a.type,
  color: a.color,
  initialBalance: a.initialBalance,
  balance: computeBalance(a.initialBalance, flows),
  archivedAt: a.archivedAt?.toISOString() ?? null,
  createdAt: a.createdAt.toISOString(),
});

export function createAccountsService(repo: AccountsRepository) {
  async function getOwned(userId: string, id: string): Promise<AccountRow> {
    const account = await repo.findById(userId, id);
    if (!account) throw new NotFoundError('Conta');
    return account;
  }

  async function assertNameFree(userId: string, name: string, exceptId?: string): Promise<void> {
    if (await repo.findActiveByName(userId, name, exceptId)) throw new ConflictError('Já existe uma conta ativa com esse nome.');
  }

  async function withBalance(userId: string, account: AccountRow): Promise<AccountDTO> {
    const flows = await repo.flowsByAccount(userId);
    return toDTO(account, flows.get(account.id));
  }

  return {
    async list(userId: string, includeArchived: boolean): Promise<AccountDTO[]> {
      const [rows, flows] = await Promise.all([repo.list(userId, includeArchived), repo.flowsByAccount(userId)]);
      return rows.map((a) => toDTO(a, flows.get(a.id)));
    },

    async create(userId: string, input: CreateAccountInput): Promise<AccountDTO> {
      await assertNameFree(userId, input.name);
      return toDTO(await repo.create(userId, input));
    },

    async update(userId: string, id: string, input: UpdateAccountInput): Promise<AccountDTO> {
      const current = await getOwned(userId, id);
      if (input.name !== undefined && current.archivedAt === null) await assertNameFree(userId, input.name, id);
      return withBalance(userId, await repo.update(userId, id, input));
    },

    async archive(userId: string, id: string): Promise<AccountDTO> {
      await getOwned(userId, id);
      return withBalance(userId, await repo.setArchived(userId, id, new Date()));
    },

    async unarchive(userId: string, id: string): Promise<AccountDTO> {
      const account = await getOwned(userId, id);
      await assertNameFree(userId, account.name, id);
      return withBalance(userId, await repo.setArchived(userId, id, null));
    },

    async remove(userId: string, id: string): Promise<void> {
      await getOwned(userId, id);
      if (await repo.isReferenced(userId, id)) {
        throw new ConflictError('A conta possui lançamentos. Arquive-a em vez de excluir.');
      }
      await repo.delete(userId, id);
    },

    async assertUsable(userId: string, id: string): Promise<void> {
      const account = await getOwned(userId, id);
      if (account.archivedAt) throw new UnprocessableError('Não é possível lançar em uma conta arquivada.');
    },
  };
}

export type AccountsService = ReturnType<typeof createAccountsService>;
