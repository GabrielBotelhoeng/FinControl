/**
 * Plano de quitação (sub-projeto 7, Q1–Q5): simula, mês a mês, pagar as dívidas com um valor mensal fixo.
 * Valores em centavos; taxas como fração ao mês. Referência: skill `debt-management` (avalanche × bola de neve).
 */
import { addMonthsToYm, type YearMonth } from './dates';

export type PayoffStrategy = 'avalanche' | 'snowball' | 'minimum';

export type PayoffDebt = {
  id: string;
  name: string;
  balance: number;
  monthlyRate: number;
  /** Pagamento obrigatório do mês (parcela); 0 quando não há parcela combinada. */
  minimum: number;
};

export type PayoffResult = {
  strategy: PayoffStrategy;
  /** Meses até quitar tudo; `null` se não quita em `MAX_PAYOFF_MONTHS`. */
  months: number | null;
  payoffMonth: YearMonth | null;
  totalInterest: number;
  totalPaid: number;
  /** Em que mês (1 = o primeiro) cada dívida acaba; `null` se não acaba. Na ordem em que são quitadas. */
  order: { id: string; name: string; month: number | null }[];
  /** Saldo total no fim de cada mês (para o gráfico), até quitar ou até o limite. */
  balances: number[];
};

export const MAX_PAYOFF_MONTHS = 600;
/** Saldo a partir do qual a simulação desiste ("não quita"): R$ 10 bilhões. Evita números sem sentido e `Infinity`. */
const RUNAWAY = 1e12;

/** Q2: soma das parcelas das dívidas com saldo, limitadas ao saldo com os juros do 1º mês. O valor mensal não pode ser menor. */
export const minimumBudget = (debts: PayoffDebt[]) =>
  debts.reduce((s, d) => (d.balance > 0 ? s + Math.min(d.minimum, Math.round(d.balance * (1 + d.monthlyRate))) : s), 0);

/** Q3: avalanche = maior taxa primeiro (empate: menor saldo); bola de neve = menor saldo primeiro (empate: maior taxa). */
function priority(strategy: PayoffStrategy) {
  return (a: { balance: number; monthlyRate: number }, b: { balance: number; monthlyRate: number }) =>
    strategy === 'avalanche'
      ? b.monthlyRate - a.monthlyRate || a.balance - b.balance
      : a.balance - b.balance || b.monthlyRate - a.monthlyRate;
}

/**
 * Q4: em cada mês, o saldo rende juros, cada dívida recebe o mínimo e o que sobra do valor mensal vai para a
 * dívida da vez (a sobra de uma quitada passa para a próxima). "Só o mínimo" não usa a sobra.
 */
export function simulatePayoff(debts: PayoffDebt[], budget: number, strategy: PayoffStrategy, start: YearMonth): PayoffResult {
  const state = debts.filter((d) => d.balance > 0).map((d) => ({ ...d, done: null as number | null }));
  let totalInterest = 0;
  let totalPaid = 0;
  const balances: number[] = [];
  let month = 0;
  // Saldos em centavos fracionários: arredondar todo mês deixava 1 centavo no fim e um mês a mais (revisão final).
  let runaway = false;
  while (state.some((d) => d.balance > 0) && month < MAX_PAYOFF_MONTHS && !runaway) {
    month += 1;
    let pool = strategy === 'minimum' ? Number.POSITIVE_INFINITY : budget;
    for (const d of state) {
      if (d.balance <= 0) continue;
      const interest = d.balance * d.monthlyRate;
      d.balance += interest;
      totalInterest += interest;
    }
    for (const d of state) {
      if (d.balance <= 0) continue;
      const pay = Math.min(d.minimum, d.balance, pool);
      d.balance -= pay;
      pool -= pay;
      totalPaid += pay;
    }
    if (strategy !== 'minimum') {
      for (const d of [...state].filter((x) => x.balance > 0).sort(priority(strategy))) {
        if (pool <= 0) break;
        const pay = Math.min(pool, d.balance);
        d.balance -= pay;
        pool -= pay;
        totalPaid += pay;
      }
    }
    for (const d of state) {
      // Resto de arredondamento (abaixo de R$ 1) vai junto com o pagamento do mês, como na última parcela do banco.
      if (d.balance > 0 && d.balance < 100) {
        totalPaid += d.balance;
        d.balance = 0;
      }
      if (d.balance === 0 && d.done === null) d.done = month;
    }
    const total = state.reduce((s, d) => s + d.balance, 0);
    runaway = !(total < RUNAWAY);
    balances.push(Math.round(total));
  }
  const allDone = state.every((d) => d.done !== null);
  const rank = priority(strategy === 'minimum' ? 'avalanche' : strategy);
  // Empate no mês (ou dívidas que não acabam): a ordem da estratégia.
  const order = [...state]
    .sort((a, b) => (a.done ?? Infinity) - (b.done ?? Infinity) || rank(debts.find((x) => x.id === a.id)!, debts.find((x) => x.id === b.id)!))
    .map((d) => ({ id: d.id, name: d.name, month: d.done }));
  return {
    strategy,
    months: allDone ? month : null,
    payoffMonth: allDone && month > 0 ? addMonthsToYm(start, month - 1) : allDone ? start : null,
    totalInterest: Math.round(totalInterest),
    totalPaid: Math.round(totalPaid),
    order,
    balances,
  };
}
