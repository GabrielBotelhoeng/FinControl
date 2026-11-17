import type { NotificationListDTO } from '@fincontrol/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../lib/api-context';

const KEY = ['notifications'];

/** N10: busca ao abrir o app e ao trocar de tela, com cache de 60 s; mudanças nos dados invalidam a chave. */
export function useNotifications() {
  const api = useApi();
  return useQuery({ queryKey: KEY, queryFn: () => api.get<NotificationListDTO>('/notifications'), staleTime: 60_000 });
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
