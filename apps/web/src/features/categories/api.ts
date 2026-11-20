import type { CategoryDTO, CategoryType } from '@fincontrol/shared';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../lib/api-context';
import { useFinanceMutation } from '../accounts/api';

export function useCategories() {
  const api = useApi();
  return useQuery({ queryKey: ['categories'], queryFn: () => api.get<CategoryDTO[]>('/categories'), staleTime: 5 * 60_000 });
}

export type CategoryInput = { name: string; type: CategoryType; icon: string; color: string };

export function useSaveCategory() {
  const api = useApi();
  return useFinanceMutation(({ id, type, ...rest }: CategoryInput & { id?: string }) =>
    id ? api.patch<CategoryDTO>(`/categories/${id}`, rest) : api.post<CategoryDTO>('/categories', { ...rest, type }),
  );
}

/** Sub-projeto 15: cria na categoria `parentId` ou renomeia (só o nome: o ícone e a cor vêm da categoria, U2). */
export function useSaveSubcategory() {
  const api = useApi();
  return useFinanceMutation(({ id, parentId, name }: { id?: string; parentId: string; name: string }) =>
    id ? api.patch<CategoryDTO>(`/categories/${id}`, { name }) : api.post<CategoryDTO>(`/categories/${parentId}/subcategories`, { name }),
  );
}

export function useDeleteCategory() {
  const api = useApi();
  return useFinanceMutation(({ id, reassignTo }: { id: string; reassignTo?: string }) =>
    api.del(`/categories/${id}${reassignTo ? `?reassignTo=${reassignTo}` : ''}`),
  );
}
