import type {
  BudgetMonthDTO, ContributionInput, CreateGoalInput, ForecastMonthDTO, GoalContributionDTO, GoalDetailDTO, GoalDTO, UpdateGoalInput, YearMonth,
} from '@fincontrol/shared';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../lib/api-context';
import { useFinanceMutation } from '../accounts/api';

export function useBudgetMonth(month: YearMonth) {
  const api = useApi();
  return useQuery({ queryKey: ['budgets', month], queryFn: () => api.get<BudgetMonthDTO>('/budgets', { month }) });
}

export function useForecast() {
  const api = useApi();
  return useQuery({ queryKey: ['planning', 'forecast'], queryFn: () => api.get<ForecastMonthDTO[]>('/planning/forecast', { months: 3 }) });
}

export function useSetBudget() {
  const api = useApi();
  return useFinanceMutation(({ categoryId, limit }: { categoryId: string; limit: number }) => api.put(`/budgets/${categoryId}`, { limit }));
}

export function useRemoveBudget() {
  const api = useApi();
  return useFinanceMutation((categoryId: string) => api.del(`/budgets/${categoryId}`));
}

export function useGoals() {
  const api = useApi();
  return useQuery({ queryKey: ['goals'], queryFn: () => api.get<GoalDTO[]>('/goals') });
}

export function useGoal(id: string) {
  const api = useApi();
  return useQuery({ queryKey: ['goals', id], queryFn: () => api.get<GoalDetailDTO>(`/goals/${id}`) });
}

export function useCreateGoal() {
  const api = useApi();
  return useFinanceMutation((input: CreateGoalInput) => api.post<GoalDetailDTO>('/goals', input));
}

export function useUpdateGoal() {
  const api = useApi();
  return useFinanceMutation(({ id, ...input }: UpdateGoalInput & { id: string }) => api.patch<GoalDetailDTO>(`/goals/${id}`, input));
}

export function useDeleteGoal() {
  const api = useApi();
  return useFinanceMutation((id: string) => api.del(`/goals/${id}`));
}

export function useAddContribution() {
  const api = useApi();
  return useFinanceMutation(({ goalId, ...input }: ContributionInput & { goalId: string }) =>
    api.post<GoalContributionDTO>(`/goals/${goalId}/contributions`, input),
  );
}

export function useDeleteContribution() {
  const api = useApi();
  return useFinanceMutation(({ goalId, contributionId }: { goalId: string; contributionId: string }) =>
    api.del(`/goals/${goalId}/contributions/${contributionId}`),
  );
}
