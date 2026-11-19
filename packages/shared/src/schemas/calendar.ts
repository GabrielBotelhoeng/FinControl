import { z } from 'zod';
import { yearMonthSchema } from './common';

export const calendarQuerySchema = z.object({ month: yearMonthSchema.optional() });

/** Lançamento no calendário (sub-projeto 8, K1): por vencimento, fora de cartão (a compra no cartão entra pela fatura). */
export type CalendarTransactionDTO = {
  kind: 'transaction';
  id: string;
  description: string;
  type: 'income' | 'expense';
  amount: number;
  status: 'pending' | 'paid';
  overdue: boolean;
  category: string | null;
};

/** Fatura de cartão que vence no mês (K2); `remaining` = valor − pago. */
export type CalendarInvoiceDTO = {
  kind: 'invoice';
  cardId: string;
  cardName: string;
  month: string;
  remaining: number;
  amount: number;
  status: 'open' | 'closed' | 'paid' | 'overdue';
  /** Fatura de um mês depois da aberta: só parcelas já lançadas, ainda pode crescer. */
  future: boolean;
};

export type CalendarItemDTO = CalendarTransactionDTO | CalendarInvoiceDTO;

export type CalendarDTO = {
  month: string;
  days: { date: string; items: CalendarItemDTO[] }[];
  /** K3: o que falta pagar e receber no mês (faturas pelo restante) e o que já foi pago e recebido. */
  totals: { toPay: number; paid: number; toReceive: number; received: number };
};
