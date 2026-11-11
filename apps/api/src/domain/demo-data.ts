import {
  addMonthsToYm, dateInMonth, endOfMonth, monthOf,
  type AccountType, type DateOnly, type TransactionNature, type TransactionStatus, type TransactionType,
} from '@fincontrol/shared';

export type DemoAccountKey = 'checking' | 'savings' | 'wallet';
export type DemoAccount = { key: DemoAccountKey; name: string; type: AccountType; color: string; initialBalance: number };
export type DemoRecurrence = {
  description: string;
  type: 'income' | 'expense';
  amount: number;
  startDate: DateOnly;
  accountKey: DemoAccountKey;
  categoryName: string;
};
export type DemoTransaction = {
  type: TransactionType;
  amount: number;
  description: string;
  accountKey: DemoAccountKey;
  destinationAccountKey: DemoAccountKey | null;
  categoryName: string | null;
  nature: TransactionNature | null;
  status: TransactionStatus;
  dueDate: DateOnly;
  paidDate: DateOnly | null;
};
export type DemoPlan = {
  accounts: DemoAccount[];
  recurrences: DemoRecurrence[];
  transactions: DemoTransaction[];
  /** Descrição da recorrência cuja ocorrência vencida mais recente fica sem pagar. */
  overdueDescription: string;
};

const HISTORY_MONTHS = 6;

const RECURRING: ReadonlyArray<{ description: string; type: 'income' | 'expense'; amount: number; day: number; categoryName: string }> = [
  { description: 'Salário', type: 'income', amount: 650000, day: 5, categoryName: 'Salário' },
  { description: 'Aluguel', type: 'expense', amount: 180000, day: 10, categoryName: 'Moradia' },
  { description: 'Internet', type: 'expense', amount: 11990, day: 15, categoryName: 'Contas' },
  { description: 'Streaming', type: 'expense', amount: 5590, day: 20, categoryName: 'Assinaturas' },
  { description: 'Academia', type: 'expense', amount: 9990, day: 8, categoryName: 'Saúde' },
];

/** PRNG pequeno e determinístico (mulberry32): a demo sai igual a cada execução e nos testes. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildDemoData(today: DateOnly, seed = 42): DemoPlan {
  const rand = mulberry32(seed);
  const cents = (min: number, max: number) => Math.round((min + rand() * (max - min)) / 10) * 10;
  const currentYm = monthOf(today);
  const firstYm = addMonthsToYm(currentYm, -HISTORY_MONTHS);

  const accounts: DemoAccount[] = [
    { key: 'checking', name: 'Conta corrente', type: 'checking', color: '#2563eb', initialBalance: 235000 },
    { key: 'savings', name: 'Poupança', type: 'savings', color: '#16a34a', initialBalance: 800000 },
    { key: 'wallet', name: 'Carteira', type: 'wallet', color: '#f59e0b', initialBalance: 15000 },
  ];

  const recurrences: DemoRecurrence[] = RECURRING.map(({ day, ...r }) => ({
    ...r, startDate: dateInMonth(firstYm, day), accountKey: 'checking',
  }));

  const transactions: DemoTransaction[] = [];
  for (let i = 0; i <= HISTORY_MONTHS; i++) {
    const ym = addMonthsToYm(firstYm, i);
    const lastDay = ym === currentYm ? Number(today.slice(8, 10)) : Number(endOfMonth(ym).slice(8, 10));
    const randomDay = () => dateInMonth(ym, 1 + Math.floor(rand() * lastDay));

    const variable = (count: number, min: number, max: number, description: string, categoryName: string) => {
      for (let k = 0; k < count; k++) {
        const d = randomDay();
        transactions.push({
          type: 'expense', amount: cents(min, max), description, accountKey: 'checking', destinationAccountKey: null,
          categoryName, nature: 'variable', status: 'paid', dueDate: d, paidDate: d,
        });
      }
    };
    variable(4, 18000, 42000, 'Mercado', 'Alimentação');
    variable(6, 1500, 6000, 'Transporte por app', 'Transporte');
    variable(3, 3500, 9000, 'Delivery', 'Alimentação');
    variable(2, 6000, 20000, 'Lazer', 'Lazer');
    variable(1, 8000, 35000, 'Compras', 'Compras');

    if (i % 2 === 0) {
      const d = randomDay();
      transactions.push({
        type: 'income', amount: cents(80000, 200000), description: 'Projeto freelance', accountKey: 'checking',
        destinationAccountKey: null, categoryName: 'Freelance', nature: 'variable', status: 'paid', dueDate: d, paidDate: d,
      });
    }

    for (const [day, amount] of [[6, 40000], [21, 20000]] as const) {
      if (day > lastDay) continue;
      const d = dateInMonth(ym, day);
      transactions.push({
        type: 'transfer', amount, description: 'Reserva de emergência', accountKey: 'checking', destinationAccountKey: 'savings',
        categoryName: null, nature: null, status: 'paid', dueDate: d, paidDate: d,
      });
    }
  }

  transactions.push({
    type: 'expense', amount: 35000, description: 'IPVA (parcela)', accountKey: 'checking', destinationAccountKey: null,
    categoryName: 'Transporte', nature: 'fixed', status: 'pending', dueDate: endOfMonth(currentYm), paidDate: null,
  });

  return { accounts, recurrences, transactions, overdueDescription: 'Internet' };
}
