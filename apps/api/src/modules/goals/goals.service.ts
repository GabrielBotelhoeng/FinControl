import {
  goalProgress, todayInSaoPaulo,
  type ContributionInput, type CreateGoalInput, type GoalContributionDTO, type GoalDetailDTO, type GoalDTO, type UpdateGoalInput,
} from '@fincontrol/shared';
import { NotFoundError, UnprocessableError } from '../../http/errors';
import { WithdrawalTooLargeError, type GoalRow, type GoalsRepository } from './goals.repository';

export function createGoalsService(deps: { repo: GoalsRepository; clock: () => Date }) {
  const today = () => todayInSaoPaulo(deps.clock());

  const toDTO = (g: GoalRow): GoalDTO => ({
    ...g,
    ...goalProgress({ target: g.targetAmount, saved: g.saved, createdAt: g.createdAt, targetDate: g.targetDate, today: today() }),
  });

  async function getOwned(userId: string, id: string): Promise<GoalRow> {
    const goal = await deps.repo.findById(userId, id);
    if (!goal) throw new NotFoundError('Meta');
    return goal;
  }

  async function detail(userId: string, id: string): Promise<GoalDetailDTO> {
    const goal = await getOwned(userId, id);
    return { ...toDTO(goal), contributions: await deps.repo.contributions(id) };
  }

  const assertFutureDeadline = (targetDate: string) => {
    if (targetDate < today()) throw new UnprocessableError('O prazo da meta não pode estar no passado.');
  };

  return {
    async list(userId: string): Promise<GoalDTO[]> {
      return (await deps.repo.list(userId)).map(toDTO);
    },

    get: detail,

    async create(userId: string, input: CreateGoalInput): Promise<GoalDetailDTO> {
      assertFutureDeadline(input.targetDate);
      return detail(userId, await deps.repo.create(userId, input));
    },

    async update(userId: string, id: string, input: UpdateGoalInput): Promise<GoalDetailDTO> {
      await getOwned(userId, id);
      if (input.targetDate !== undefined) assertFutureDeadline(input.targetDate);
      await deps.repo.update(userId, id, input);
      return detail(userId, id);
    },

    async remove(userId: string, id: string): Promise<void> {
      await getOwned(userId, id);
      await deps.repo.delete(userId, id);
    },

    async addContribution(userId: string, id: string, input: ContributionInput): Promise<GoalContributionDTO> {
      await getOwned(userId, id);
      if (input.date > today()) throw new UnprocessableError('O depósito não pode ter data futura.');
      try {
        return await deps.repo.addContribution(userId, id, input);
      } catch (err) {
        if (err instanceof WithdrawalTooLargeError) throw new UnprocessableError('Não dá para retirar mais do que está guardado.');
        throw err;
      }
    },

    async removeContribution(userId: string, id: string, contributionId: string): Promise<void> {
      await getOwned(userId, id);
      if (!(await deps.repo.deleteContribution(userId, id, contributionId))) throw new NotFoundError('Depósito');
    },
  };
}

export type GoalsService = ReturnType<typeof createGoalsService>;
