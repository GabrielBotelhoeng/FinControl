import type { BankDTO, CreateLoanInput, LoanDetailDTO, LoanDTO } from '@fincontrol/shared';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../lib/api-context';
import { useFinanceMutation } from '../accounts/api';

export function useLoans() {
  const api = useApi();
  return useQuery({ queryKey: ['loans'], queryFn: () => api.get<LoanDTO[]>('/loans') });
}

export function useLoan(id: string) {
  const api = useApi();
  return useQuery({ queryKey: ['loans', id], queryFn: () => api.get<LoanDetailDTO>(`/loans/${id}`) });
}

/** Instituições da última sincronização com o Banco Central; só busca a partir de 2 letras. */
export function useBanks(q: string) {
  const api = useApi();
  return useQuery({ queryKey: ['banks', q], queryFn: () => api.get<BankDTO[]>('/banks', { q }), enabled: q.length >= 2, staleTime: 60_000 });
}

/** Criar e excluir mexem em lançamentos, saldos e painel: as mutações invalidam tudo que depende disso. */
export function useCreateLoan() {
  const api = useApi();
  return useFinanceMutation((input: Omit<CreateLoanInput, 'installmentsPaidBefore'> & { installmentsPaidBefore: number }) =>
    api.post<LoanDetailDTO>('/loans', input),
  );
}

export function useRenameLoan() {
  const api = useApi();
  return useFinanceMutation(({ id, name }: { id: string; name: string }) => api.patch<LoanDetailDTO>(`/loans/${id}`, { name }));
}

export function useDeleteLoan() {
  const api = useApi();
  return useFinanceMutation((id: string) => api.del(`/loans/${id}`));
}
