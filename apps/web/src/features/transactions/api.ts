import type { Frequency, Scope, TransactionDTO, TransactionPage, TransactionType } from '@fincontrol/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useApi } from '../../lib/api-context';
import { useFinanceMutation } from '../accounts/api';

export type TransactionFilters = {
  from: string;
  to: string;
  type?: TransactionType | undefined;
  status?: 'pending' | 'paid' | undefined;
  accountId?: string | undefined;
  categoryId?: string | undefined;
  q?: string | undefined;
};

const PAGE_SIZE = 30;

export function useTransactions(filters: TransactionFilters) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: ['transactions', filters],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.get<TransactionPage>('/transactions', { ...filters, cursor: pageParam, limit: PAGE_SIZE }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function usePayToggle() {
  const api = useApi();
  return useFinanceMutation(({ id, paid }: { id: string; paid: boolean }) =>
    api.post<TransactionDTO>(`/transactions/${id}/${paid ? 'pay' : 'unpay'}`, {}),
  );
}

export type TransactionFields = {
  amount: number;
  description: string;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  nature: 'fixed' | 'variable' | null;
  dueDate: string;
};

export type NewTransaction = TransactionFields & {
  type: TransactionType;
  status: 'pending' | 'paid';
  recurrence: { frequency: Frequency; endDate: string | null } | null;
  /** Compra parcelada no cartão (2–48); 1x é à vista e não envia o campo (decisão R19, Tarefa 11). */
  installments?: number;
};

export function useCreateTransaction() {
  const api = useApi();
  return useFinanceMutation((t: NewTransaction) => api.post<TransactionDTO>('/transactions', t));
}

export function useUpdateTransaction() {
  const api = useApi();
  return useFinanceMutation(({ id, scope, fields }: { id: string; scope: Scope; fields: TransactionFields }) =>
    api.patch<TransactionDTO>(`/transactions/${id}${scope === 'future' ? '?scope=future' : ''}`, fields),
  );
}

export function useDeleteTransaction() {
  const api = useApi();
  return useFinanceMutation(({ id, scope }: { id: string; scope: Scope }) => api.del(`/transactions/${id}${scope === 'future' ? '?scope=future' : ''}`));
}
