import type { NotificationListDTO } from '@fincontrol/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useApi } from '../../lib/api-context';

const KEY = ['notifications'];
const STALE_MS = 60_000;

/** Uma busca em andamento, se terminar depois, devolveria o "não lido" antigo: cancela antes de gravar. */
async function replaceList(queryClient: QueryClient, list: NotificationListDTO) {
  await queryClient.cancelQueries({ queryKey: KEY });
  queryClient.setQueryData(KEY, list);
}

/**
 * N10: busca ao abrir o app, ao voltar para a aba e ao trocar de tela com o dado velho (60 s,
 * `useRefreshOnNavigation`); mudanças nos dados invalidam a chave. Sem intervalo fixo: cada busca grava a memória dos avisos.
 */
export function useNotifications() {
  const api = useApi();
  return useQuery({ queryKey: KEY, queryFn: () => api.get<NotificationListDTO>('/notifications'), staleTime: STALE_MS, refetchOnWindowFocus: true });
}

/**
 * N10: ao trocar de tela, busca de novo se a lista tem mais de 60 s. Só a navegação dispara: o sino fica sempre
 * montado, e reagir à lista ficar velha sozinha viraria uma busca (e uma gravação) por minuto em cada aba aberta.
 */
export function useRefreshOnNavigation() {
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  useEffect(() => {
    const updatedAt = queryClient.getQueryState(KEY)?.dataUpdatedAt ?? 0;
    if (updatedAt > 0 && Date.now() - updatedAt > STALE_MS) void queryClient.refetchQueries({ queryKey: KEY });
  }, [pathname, queryClient]);
}

/** A API devolve a lista atualizada: grava direto no cache, sem uma segunda busca. */
export function useMarkRead() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keys: string[]) => api.post<NotificationListDTO>('/notifications/read', { keys }),
    onSuccess: (list) => replaceList(queryClient, list),
  });
}

export function useMarkAllRead() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<NotificationListDTO>('/notifications/read-all'),
    onSuccess: (list) => replaceList(queryClient, list),
  });
}
