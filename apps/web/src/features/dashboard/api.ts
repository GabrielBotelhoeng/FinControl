import type { CategorySpendDTO, DashboardSummaryDTO, EvolutionPointDTO, YearMonth } from '@fincontrol/shared';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../lib/api-context';

export function useSummary(month: YearMonth) {
  const api = useApi();
  return useQuery({ queryKey: ['dashboard', 'summary', month], queryFn: () => api.get<DashboardSummaryDTO>('/dashboard/summary', { month }) });
}

export function useEvolution(months = 6) {
  const api = useApi();
  return useQuery({ queryKey: ['dashboard', 'evolution', months], queryFn: () => api.get<EvolutionPointDTO[]>('/dashboard/evolution', { months }) });
}

export function useByCategory(month: YearMonth) {
  const api = useApi();
  return useQuery({ queryKey: ['dashboard', 'by-category', month], queryFn: () => api.get<CategorySpendDTO[]>('/dashboard/by-category', { month }) });
}
