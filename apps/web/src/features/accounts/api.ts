import type { AccountDTO, AccountType } from '@fincontrol/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../lib/api-context';

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Conta corrente' },
  { value: 'savings', label: 'Poupança' },
  { value: 'wallet', label: 'Carteira' },
  { value: 'investment', label: 'Investimento' },
];

export const accountTypeLabel = (t: AccountType) => ACCOUNT_TYPES.find((x) => x.value === t)?.label ?? t;

export function useAccounts(includeArchived = false) {
  const api = useApi();
  return useQuery({
    queryKey: ['accounts', { includeArchived }],
    queryFn: () => api.get<AccountDTO[]>('/accounts', { includeArchived }),
  });
}

/** Mutação que, ao terminar, invalida tudo que depende de saldo. */
export function useFinanceMutation<TVars, TData = unknown>(fn: (vars: TVars) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all(['accounts', 'transactions', 'dashboard', 'categories'].map((k) => queryClient.invalidateQueries({ queryKey: [k] }))),
  });
}

export type AccountInput = { name: string; type: AccountType; color: string; initialBalance: number };

export function useSaveAccount() {
  const api = useApi();
  return useFinanceMutation(({ id, ...body }: AccountInput & { id?: string }) =>
    id ? api.patch<AccountDTO>(`/accounts/${id}`, body) : api.post<AccountDTO>('/accounts', body),
  );
}

export function useArchiveAccount() {
  const api = useApi();
  return useFinanceMutation(({ id, archive }: { id: string; archive: boolean }) =>
    api.post<AccountDTO>(`/accounts/${id}/${archive ? 'archive' : 'unarchive'}`),
  );
}

export function useTransfer() {
  const api = useApi();
  return useFinanceMutation((t: { accountId: string; destinationAccountId: string; amount: number; dueDate: string; description: string }) =>
    api.post('/transactions', { ...t, type: 'transfer', status: 'paid', paidDate: t.dueDate }),
  );
}
