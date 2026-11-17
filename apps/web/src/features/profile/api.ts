import type { NotificationPrefs, ProfileDTO, UpdateProfileInput } from '@fincontrol/shared';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../lib/api-context';

export function useProfile() {
  const api = useApi();
  return useQuery({ queryKey: ['me'], queryFn: () => api.get<ProfileDTO>('/me') });
}

export function useUpdateProfile() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => api.patch<ProfileDTO>('/me', input),
    onSuccess: async (profile) => {
      queryClient.setQueryData(['me'], profile);
      // As preferências mudam o que o sino mostra (sub-projeto 5, N7).
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

const PREFS_MUTATION = ['me', 'notificationPrefs'];

/**
 * Preferências de notificação (N7) com atualização otimista no cache do perfil: a caixa muda na hora. Em erro,
 * busca o perfil de novo (a verdade do servidor), o que também resolve cliques seguidos com respostas fora de
 * ordem. Quando o último salvamento termina, sincroniza perfil e sino.
 */
export function useUpdateNotificationPrefs() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: PREFS_MUTATION,
    mutationFn: (prefs: NotificationPrefs) => api.patch<ProfileDTO>('/me', { notificationPrefs: prefs }),
    onMutate: async (prefs) => {
      await queryClient.cancelQueries({ queryKey: ['me'] });
      const current = queryClient.getQueryData<ProfileDTO>(['me']);
      if (current) queryClient.setQueryData<ProfileDTO>(['me'], { ...current, notificationPrefs: prefs });
    },
    onError: (e) => toast.error(e.message),
    onSettled: async () => {
      if (queryClient.isMutating({ mutationKey: PREFS_MUTATION }) > 1) return;
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['me'] }), queryClient.invalidateQueries({ queryKey: ['notifications'] })]);
    },
  });
}

export function useDeleteAccount() {
  const api = useApi();
  return useMutation({ mutationFn: () => api.del('/me') });
}
