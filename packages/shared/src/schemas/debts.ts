import { z } from 'zod';
import type { DebtStatus, DebtSummary } from '../debt';
import { MAX_CENTS } from '../money';
import { centsSchema, dateOnlySchema, idSchema, nonEmpty, NON_EMPTY_MESSAGE } from './common';

/** Tipo do credor (spec do sub-projeto 6, V2): só o ícone e o filtro. */
export const debtKindSchema = z.enum(['bank', 'store', 'utility', 'tax', 'person', 'other']);
export type DebtKind = z.infer<typeof debtKindSchema>;

export const DEBT_KIND_LABELS: Record<DebtKind, string> = {
  bank: 'Banco ou financeira',
  store: 'Loja ou crediário',
  utility: 'Conta de consumo',
  tax: 'Imposto ou taxa',
  person: 'Pessoa',
  other: 'Outro',
};

export const DEBT_STATUS_LABELS: Record<DebtStatus, string> = {
  open: 'Em aberto',
  agreement: 'Em acordo',
  late: 'Em atraso',
  paid_off: 'Quitada',
};

const debtTextSchema = z.string().trim().min(1, 'Obrigatório').max(80, 'Máximo de 80 caracteres');
const noteSchema = z.string().trim().max(280, 'Máximo de 280 caracteres');

/** "Deve desde" no futuro depende de hoje: validado no serviço (422). */
export const createDebtSchema = z.object({
  name: debtTextSchema,
  creditor: debtTextSchema,
  kind: debtKindSchema,
  originalAmount: centsSchema,
  since: dateOnlySchema,
  /** Quanto deve hoje, com juros e multa; sem ele, vale o original (V4). */
  currentAmount: centsSchema.optional(),
});
export const updateDebtSchema = z
  .object({ name: debtTextSchema, creditor: debtTextSchema, kind: debtKindSchema })
  .partial()
  .refine(nonEmpty, NON_EMPTY_MESSAGE);

/** V4: o valor de hoje informado pelo credor. Zero vale (o credor perdoou ou a pessoa quitou por fora). */
export const debtValuationSchema = z.object({
  amount: z.number('Informe um número').int('Valor deve ser em centavos (inteiro)').min(0, 'Não pode ser negativo').max(MAX_CENTS, 'Valor acima do limite'),
  note: noteSchema.optional(),
});

/** V5: negociação; não mexe no saldo. */
export const debtNoteSchema = z.object({ text: noteSchema.min(1, 'Obrigatório'), amount: centsSchema.optional() });

/** V7: o 1º vencimento entre hoje e 1 ano é validado no serviço. */
export const debtAgreementSchema = z.object({
  downPayment: z.number('Informe um número').int('Valor deve ser em centavos (inteiro)').min(0, 'Não pode ser negativo').max(MAX_CENTS, 'Valor acima do limite').default(0),
  installments: z.number('Informe um número').int('Número inteiro').min(1, 'Mínimo de 1 parcela').max(120, 'Máximo de 120 parcelas'),
  installmentAmount: centsSchema,
  firstDueDate: dateOnlySchema,
  accountId: idSchema,
});

/** V8: a data entre a última atualização e hoje é validada no serviço. */
export const debtPaymentSchema = z.object({ amount: centsSchema, date: dateOnlySchema, accountId: idSchema });

export type CreateDebtInput = z.output<typeof createDebtSchema>;
export type UpdateDebtInput = z.output<typeof updateDebtSchema>;
export type DebtValuationInput = z.output<typeof debtValuationSchema>;
export type DebtNoteInput = z.output<typeof debtNoteSchema>;
export type DebtAgreementInput = z.output<typeof debtAgreementSchema>;
export type DebtPaymentInput = z.output<typeof debtPaymentSchema>;

export type DebtDTO = DebtSummary & {
  id: string;
  name: string;
  creditor: string;
  kind: DebtKind;
  since: string;
  status: DebtStatus;
  nextDue: { date: string; amount: number } | null;
};

export type DebtAgreementDTO = {
  date: string;
  total: number;
  downPayment: number;
  installments: number;
  installmentAmount: number;
  /** As parcelas deste acordo, pagas ou não, em ordem. */
  schedule: { transactionId: string; number: number; dueDate: string; amount: number; paidDate: string | null; overdue: boolean }[];
};

/** Linha do tempo (V5), do mais novo ao mais antigo. `delta` = mudança do saldo numa âncora. */
export type DebtTimelineItemDTO =
  | { kind: 'valuation'; id: string; date: string; amount: number; delta: number | null; note: string | null }
  | { kind: 'agreement'; id: string; date: string; amount: number; delta: number; installments: number; installmentAmount: number; downPayment: number; cancelledAt: string | null }
  | { kind: 'note'; id: string; date: string; text: string; amount: number | null }
  | { kind: 'payment'; id: string; date: string; amount: number; description: string };

export type DebtDetailDTO = DebtDTO & { agreement: DebtAgreementDTO | null; timeline: DebtTimelineItemDTO[]; lastAnchorDate: string | null };
