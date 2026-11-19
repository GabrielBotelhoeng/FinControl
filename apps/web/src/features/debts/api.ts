import type {
  CreateDebtInput, DebtAgreementInput, DebtDetailDTO, DebtDTO, DebtNoteInput, DebtPaymentInput, DebtValuationInput, UpdateDebtInput,
} from '@fincontrol/shared';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../lib/api-context';
import { useFinanceMutation } from '../accounts/api';

export function useDebts() {
  const api = useApi();
  return useQuery({ queryKey: ['debts'], queryFn: () => api.get<DebtDTO[]>('/debts') });
}

/** `enabled: false` enquanto a dívida é excluída, para a invalidação não pedir um recurso apagado. */
export function useDebt(id: string, enabled = true) {
  const api = useApi();
  return useQuery({ queryKey: ['debts', id], queryFn: () => api.get<DebtDetailDTO>(`/debts/${id}`), enabled });
}

/** Toda ação na dívida mexe no total de dívidas (painel, relatórios) e às vezes em lançamentos: invalida tudo. */
export function useCreateDebt() {
  const api = useApi();
  return useFinanceMutation((input: CreateDebtInput) => api.post<DebtDetailDTO>('/debts', input));
}

export function useUpdateDebt() {
  const api = useApi();
  return useFinanceMutation(({ id, ...input }: UpdateDebtInput & { id: string }) => api.patch<DebtDetailDTO>(`/debts/${id}`, input));
}

export function useDeleteDebt() {
  const api = useApi();
  return useFinanceMutation((id: string) => api.del(`/debts/${id}`));
}

export function useDebtValuation() {
  const api = useApi();
  return useFinanceMutation(({ id, ...input }: DebtValuationInput & { id: string }) => api.post<DebtDetailDTO>(`/debts/${id}/valuations`, input));
}

export function useDebtNote() {
  const api = useApi();
  return useFinanceMutation(({ id, ...input }: DebtNoteInput & { id: string }) => api.post<DebtDetailDTO>(`/debts/${id}/notes`, input));
}

export function useDebtAgreement() {
  const api = useApi();
  return useFinanceMutation(({ id, ...input }: DebtAgreementInput & { id: string }) => api.post<DebtDetailDTO>(`/debts/${id}/agreement`, input));
}

export function useCancelDebtAgreement() {
  const api = useApi();
  return useFinanceMutation((id: string) => api.del(`/debts/${id}/agreement`));
}

export function useDebtPayment() {
  const api = useApi();
  return useFinanceMutation(({ id, ...input }: DebtPaymentInput & { id: string }) => api.post<DebtDetailDTO>(`/debts/${id}/payments`, input));
}
