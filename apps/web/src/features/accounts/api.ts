import type { AccountDTO, AccountType } from '@fincontrol/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../lib/api-context';

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Conta corrente' },
  { value: 'savings', label: 'Poupança' },
  { value: 'wallet', label: 'Carteira' },
  { value: 'investment', label: 'Investimento' },
  { value: 'credit_card', label: 'Cartão de crédito' },
];

export const accountTypeLabel = (t: AccountType) => ACCOUNT_TYPES.find((x) => x.value === t)?.label ?? t;

export function useAccounts(includeArchived = false) {
  const api = useApi();
  return useQuery({
    queryKey: ['accounts', { includeArchived }],
    queryFn: () => api.get<AccountDTO[]>('/accounts', { includeArchived }),
  });
}

// 'cards': faturas (Tarefa 11) — limite, totais e lançamentos de uma fatura também dependem de saldo/lançamentos.
const FINANCE_KEYS = ['accounts', 'transactions', 'dashboard', 'categories', 'cards'];

/**
 * Mutação que, ao terminar, invalida tudo que depende de saldo.
 * Cancela antes de invalidar: no primeiro carregamento (ainda sem dados), o React Query reaproveitaria a
 * busca em andamento, que saiu antes da mutação e volta sem o item novo.
 */
export function useFinanceMutation<TVars, TData = unknown>(fn: (vars: TVars) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all(FINANCE_KEYS.map((k) => queryClient.cancelQueries({ queryKey: [k] })));
      await Promise.all(FINANCE_KEYS.map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
    },
  });
}

export type AccountInput = {
  name: string;
  type: AccountType;
  color: string;
  initialBalance: number;
  creditLimit?: number;
  closingDay?: number;
  dueDay?: number;
  paymentAccountId?: string;
};

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
