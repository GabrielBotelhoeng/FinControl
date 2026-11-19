import type { AssetDetailDTO, AssetValuationInput, CreateAssetInput, NetWorthDTO, UpdateAssetInput } from '@fincontrol/shared';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../lib/api-context';
import { useFinanceMutation } from '../accounts/api';

export function useNetWorth() {
  const api = useApi();
  return useQuery({ queryKey: ['net-worth'], queryFn: () => api.get<NetWorthDTO>('/net-worth') });
}

/** `enabled: false` enquanto o bem é excluído, para a invalidação não pedir um recurso apagado. */
export function useAsset(id: string, enabled = true) {
  const api = useApi();
  return useQuery({ queryKey: ['assets', id], queryFn: () => api.get<AssetDetailDTO>(`/assets/${id}`), enabled });
}

/** Toda mudança num bem mexe no patrimônio (página e painel): invalida tudo, como as outras mutações financeiras. */
export function useCreateAsset() {
  const api = useApi();
  return useFinanceMutation((input: CreateAssetInput) => api.post<AssetDetailDTO>('/assets', input));
}

export function useUpdateAsset() {
  const api = useApi();
  return useFinanceMutation(({ id, ...input }: UpdateAssetInput & { id: string }) => api.patch<AssetDetailDTO>(`/assets/${id}`, input));
}

export function useDeleteAsset() {
  const api = useApi();
  return useFinanceMutation((id: string) => api.del(`/assets/${id}`));
}

export function useAddValuation() {
  const api = useApi();
  return useFinanceMutation(({ id, ...input }: AssetValuationInput & { id: string }) => api.post<AssetDetailDTO>(`/assets/${id}/valuations`, input));
}

export function useDeleteValuation() {
  const api = useApi();
  return useFinanceMutation(({ id, valuationId }: { id: string; valuationId: string }) => api.del(`/assets/${id}/valuations/${valuationId}`));
}
