import type { ProfileDTO, UpdateProfileInput } from '@fincontrol/shared';
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
    onSuccess: (profile) => queryClient.setQueryData(['me'], profile),
  });
}

export function useDeleteAccount() {
  const api = useApi();
  return useMutation({ mutationFn: () => api.del('/me') });
}
