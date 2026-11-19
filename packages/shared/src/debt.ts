/**
 * Dívidas com credores (spec do sub-projeto 6, V3, V6 e V9). Valores em centavos.
 * Âncora = atualização de valor ou acordo; o saldo nunca é guardado, sai sempre destas regras.
 */
import type { DateOnly } from './dates';

/** `recordedAt` (ISO) desempata âncora e pagamento no mesmo dia: vale a ordem em que foram registrados. */
export type DebtLedgerEntry = { date: DateOnly; recordedAt: string; amount: number; id?: string };
export type DebtLedger = { anchors: DebtLedgerEntry[]; payments: DebtLedgerEntry[] };
export type DebtSummary = { original: number; interest: number; discounts: number; paid: number; balance: number; fraction: number };
export type DebtStatus = 'open' | 'agreement' | 'late' | 'paid_off';

/** Ordem por data e, no mesmo dia, pelo momento do registro (dívidas e bens). */
export const compareByMoment = (a: { date: DateOnly; recordedAt: string }, b: { date: DateOnly; recordedAt: string }) =>
  a.date === b.date ? (a.recordedAt < b.recordedAt ? -1 : a.recordedAt > b.recordedAt ? 1 : 0) : a.date < b.date ? -1 : 1;
const byMoment = compareByMoment;

/** Percorre âncoras e pagamentos em ordem até `date` (inclusive) — uma regra só para o saldo e o resumo. */
export function debtSummary(ledger: DebtLedger, date: DateOnly): DebtSummary {
  const events = [
    ...ledger.anchors.map((e) => ({ ...e, anchor: true })),
    ...ledger.payments.map((e) => ({ ...e, anchor: false })),
  ].sort(byMoment);
  let started = false;
  let original = 0;
  let interest = 0;
  let discounts = 0;
  let paid = 0;
  let balance = 0;
  for (const e of events) {
    if (e.date > date) break;
    if (e.anchor) {
      if (!started) original = e.amount;
      else if (e.amount > balance) interest += e.amount - balance;
      else discounts += balance - e.amount;
      started = true;
      balance = e.amount;
    } else if (started) {
      paid += e.amount;
      balance = Math.max(balance - e.amount, 0);
    }
  }
  const fraction = paid + balance === 0 ? 1 : paid / (paid + balance);
  return { original, interest, discounts, paid, balance, fraction };
}

/** V6 na linha do tempo: quanto cada âncora mudou o saldo (`null` na primeira), pelo `id` da âncora. */
export function debtAnchorDeltas(ledger: DebtLedger): Map<string, number | null> {
  const out = new Map<string, number | null>();
  const anchors = [...ledger.anchors].sort(byMoment);
  anchors.forEach((a, i) => {
    if (!a.id) return;
    if (i === 0) {
      out.set(a.id, null);
      return;
    }
    // Saldo logo antes da âncora: tudo o que veio antes dela (âncoras anteriores e pagamentos registrados antes).
    const before = debtSummary(
      { anchors: anchors.slice(0, i), payments: ledger.payments.filter((p) => byMoment(p, a) < 0) },
      a.date,
    ).balance;
    out.set(a.id, a.amount - before);
  });
  return out;
}

/** V3: saldo no fim do dia `date`. */
export const debtBalanceAt = (ledger: DebtLedger, date: DateOnly): number => debtSummary(ledger, date).balance;

export function debtStatus(i: { balance: number; lastAnchorIsAgreement: boolean; hasOverdueInstallment: boolean }): DebtStatus {
  if (i.balance === 0) return 'paid_off';
  if (!i.lastAnchorIsAgreement) return 'open';
  return i.hasOverdueInstallment ? 'late' : 'agreement';
}
