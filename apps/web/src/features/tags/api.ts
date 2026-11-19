import type { TagDTO } from '@fincontrol/shared';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../lib/api-context';
import { useFinanceMutation } from '../accounts/api';

/** Tags em uso (sub-projeto 13, T6), com quantos lançamentos usam cada uma. */
export function useTags() {
  const api = useApi();
  return useQuery({ queryKey: ['tags'], queryFn: () => api.get<TagDTO[]>('/tags') });
}

/** Renomear ou excluir mexe nos lançamentos: invalida tudo, como as outras mutações financeiras. */
export function useRenameTag() {
  const api = useApi();
  return useFinanceMutation(({ from, to }: { from: string; to: string }) => api.patch<TagDTO>(`/tags/${encodeURIComponent(from)}`, { name: to }));
}

export function useDeleteTag() {
  const api = useApi();
  return useFinanceMutation((name: string) => api.del(`/tags/${encodeURIComponent(name)}`));
}
