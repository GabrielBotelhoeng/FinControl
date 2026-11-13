import type { InvoiceDTO, PayInvoiceInput, TransactionDTO, YearMonth } from '@fincontrol/shared';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../lib/api-context';
import { useFinanceMutation } from '../accounts/api';

export type InvoiceDetailDTO = InvoiceDTO & { transactions: TransactionDTO[] };

/** As faturas do cartão, da mais recente para a mais antiga, a aberta primeiro (contrato do `GET /cards/:id/invoices`). */
export function useCardInvoices(cardId: string) {
  const api = useApi();
  return useQuery({
    queryKey: ['cards', cardId, 'invoices'],
    queryFn: () => api.get<InvoiceDTO[]>(`/cards/${cardId}/invoices`),
  });
}

/** A fatura com os lançamentos (compras e pagamentos); `enabled` permite carregar o detalhe sob demanda. */
export function useInvoiceDetail(cardId: string, month: YearMonth, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: ['cards', cardId, 'invoices', month],
    queryFn: () => api.get<InvoiceDetailDTO>(`/cards/${cardId}/invoices/${month}`),
    enabled,
  });
}

export function usePayInvoice() {
  const api = useApi();
  return useFinanceMutation(({ cardId, month, ...input }: { cardId: string; month: YearMonth } & PayInvoiceInput) =>
    api.post<TransactionDTO>(`/cards/${cardId}/invoices/${month}/payments`, input),
  );
}
