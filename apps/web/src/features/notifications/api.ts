import type { NotificationListDTO } from '@fincontrol/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../lib/api-context';

const KEY = ['notifications'];

/**
 * N10: busca ao abrir o app, ao voltar para a aba e ao trocar de tela com o dado velho (60 s; o sino chama
 * `refetch`); mudanças nos dados invalidam a chave. Sem intervalo fixo: cada busca grava a memória dos avisos.
 */
export function useNotifications() {
  const api = useApi();
  return useQuery({ queryKey: KEY, queryFn: () => api.get<NotificationListDTO>('/notifications'), staleTime: 60_000, refetchOnWindowFocus: true });
}

/** A API devolve a lista atualizada: grava direto no cache, sem uma segunda busca. */
export function useMarkRead() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keys: string[]) => api.post<NotificationListDTO>('/notifications/read', { keys }),
    onSuccess: (list) => queryClient.setQueryData(KEY, list),
  });
}

export function useMarkAllRead() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<NotificationListDTO>('/notifications/read-all'),
    onSuccess: (list) => queryClient.setQueryData(KEY, list),
  });
}
