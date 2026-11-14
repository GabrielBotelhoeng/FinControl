import {
  addMonthsToYm, dateInMonth, endOfMonth, installmentDate, invoiceDates, invoiceFor, minDate, monthOf, splitInstallments,
  type AccountType, type DateOnly, type TransactionNature, type TransactionStatus, type TransactionType, type YearMonth,
} from '@fincontrol/shared';

export type DemoAccountKey = 'checking' | 'savings' | 'wallet' | 'card';
export type DemoAccount = {
  key: DemoAccountKey;
  name: string;
  type: AccountType;
  color: string;
  initialBalance: number;
  /** Só na conta `card` (spec C2): limite, dias de fechamento/vencimento e a conta que paga a fatura. */
  creditLimit?: number;
  closingDay?: number;
  dueDay?: number;
  paymentAccountKey?: DemoAccountKey;
};
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
  /** Mês da fatura do cartão (spec C3/C4); `null` fora de compra ou pagamento de cartão. */
  invoiceMonth: YearMonth | null;
  /** Agrupa as parcelas de uma mesma compra (decisão R10); `null` fora de compra parcelada. */
  installmentGroupId: string | null;
  installmentNumber: number | null;
  installmentTotal: number | null;
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

/** "Cartão principal" da demo (decisão do controlador): fecha no dia 26, vence no dia 5, pagadora = conta corrente. */
const CARD = { name: 'Cartão principal', color: '#7c3aed', creditLimit: 800000, closingDay: 26, dueDay: 5 } as const;

/** Compras do cartão por fatura, nas categorias padrão "Alimentação", "Compras" e "Lazer" (decisão do controlador). */
const CARD_PURCHASES: ReadonlyArray<{ count: number; min: number; max: number; description: string; categoryName: string }> = [
  { count: 3, min: 3000, max: 12000, description: 'Restaurante', categoryName: 'Alimentação' },
  { count: 1, min: 9000, max: 30000, description: 'Compras online', categoryName: 'Compras' },
  { count: 1, min: 4000, max: 15000, description: 'Cinema', categoryName: 'Lazer' },
];

/** Compra parcelada em andamento (decisão do controlador): R$ 1.200 em 10x, iniciada alguns meses atrás. */
const INSTALLMENT_PURCHASE = {
  amount: 120000, installments: 10, description: 'Notebook', categoryName: 'Compras', monthsBeforeToday: 3, day: 10,
} as const;
/** UUID fixo (nunca `randomUUID()`): mantém `buildDemoData` puro e determinístico. */
const DEMO_INSTALLMENT_GROUP_ID = 'a0000000-0000-4000-8000-000000000001';

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
    {
      key: 'card', name: CARD.name, type: 'credit_card', color: CARD.color, initialBalance: 0,
      creditLimit: CARD.creditLimit, closingDay: CARD.closingDay, dueDay: CARD.dueDay, paymentAccountKey: 'checking',
    },
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
          invoiceMonth: null, installmentGroupId: null, installmentNumber: null, installmentTotal: null,
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
        invoiceMonth: null, installmentGroupId: null, installmentNumber: null, installmentTotal: null,
      });
    }

    for (const [day, amount] of [[6, 40000], [21, 20000]] as const) {
      if (day > lastDay) continue;
      const d = dateInMonth(ym, day);
      transactions.push({
        type: 'transfer', amount, description: 'Reserva de emergência', accountKey: 'checking', destinationAccountKey: 'savings',
        categoryName: null, nature: null, status: 'paid', dueDate: d, paidDate: d,
        invoiceMonth: null, installmentGroupId: null, installmentNumber: null, installmentTotal: null,
      });
    }
  }

  transactions.push({
    type: 'expense', amount: 35000, description: 'IPVA (parcela)', accountKey: 'checking', destinationAccountKey: null,
    categoryName: 'Transporte', nature: 'fixed', status: 'pending', dueDate: endOfMonth(currentYm), paidDate: null,
    invoiceMonth: null, installmentGroupId: null, installmentNumber: null, installmentTotal: null,
  });

  // --- Cartão: compras nas faturas de M-6 até a aberta (M = invoiceFor(hoje)), pagamentos por transferência e
  // uma compra parcelada em andamento (decisão do controlador). Reaproveita exatamente `invoiceFor`/`invoiceDates`/
  // `splitInstallments`/`installmentDate` de @fincontrol/shared — as mesmas funções que a API usa para gravar
  // compras e pagamentos de fatura (Tarefas 6/7) — nada de fatura ou parcela reimplementado aqui.
  const openInvoiceMonth = invoiceFor(today, CARD.closingDay, CARD.dueDay).invoiceMonth;
  const invoiceTotals = new Map<YearMonth, number>();
  const addToInvoice = (month: YearMonth, amount: number) => invoiceTotals.set(month, (invoiceTotals.get(month) ?? 0) + amount);

  for (let i = -HISTORY_MONTHS; i <= 0; i++) {
    const invoiceMonth = addMonthsToYm(openInvoiceMonth, i);
    const purchaseMonth = addMonthsToYm(invoiceMonth, -1);
    // A fatura aberta (i = 0) tem compras datadas no próprio mês corrente: o dia fica limitado a hoje. O
    // `minDate` abaixo cobre o caso raro em que hoje já passou do dia 26 — aí `purchaseMonth` seria o mês
    // seguinte (ainda no futuro) e a compra cai direto em hoje, que por definição já é a fatura aberta.
    const dayLimit = purchaseMonth === currentYm ? Math.min(26, Number(today.slice(8, 10))) : 26;
    for (const p of CARD_PURCHASES) {
      for (let k = 0; k < p.count; k++) {
        const raw = dateInMonth(purchaseMonth, 1 + Math.floor(rand() * dayLimit));
        const date = minDate(raw, today);
        const amount = cents(p.min, p.max);
        transactions.push({
          type: 'expense', amount, description: p.description, accountKey: 'card', destinationAccountKey: null,
          categoryName: p.categoryName, nature: 'variable', status: 'paid', dueDate: date, paidDate: date,
          invoiceMonth, installmentGroupId: null, installmentNumber: null, installmentTotal: null,
        });
        addToInvoice(invoiceMonth, amount);
      }
    }
  }

  // Compra parcelada em andamento: alguns meses atrás, de forma que uma parcela cai na fatura do mês corrente
  // (decisão do controlador — é isso que faz `health.debtCommitment > 0` pela decisão R15).
  const installmentPurchaseDate = dateInMonth(addMonthsToYm(currentYm, -INSTALLMENT_PURCHASE.monthsBeforeToday), INSTALLMENT_PURCHASE.day);
  const installmentAmounts = splitInstallments(INSTALLMENT_PURCHASE.amount, INSTALLMENT_PURCHASE.installments);
  const firstInstallmentInvoice = invoiceFor(installmentPurchaseDate, CARD.closingDay, CARD.dueDay).invoiceMonth;
  installmentAmounts.forEach((amount, idx) => {
    const k = idx + 1;
    const date = installmentDate(installmentPurchaseDate, k);
    const invoiceMonth = addMonthsToYm(firstInstallmentInvoice, k - 1);
    transactions.push({
      type: 'expense', amount, description: INSTALLMENT_PURCHASE.description, accountKey: 'card', destinationAccountKey: null,
      categoryName: INSTALLMENT_PURCHASE.categoryName, nature: 'variable', status: 'paid', dueDate: date, paidDate: date,
      invoiceMonth, installmentGroupId: DEMO_INSTALLMENT_GROUP_ID, installmentNumber: k, installmentTotal: INSTALLMENT_PURCHASE.installments,
    });
    addToInvoice(invoiceMonth, amount);
  });

  // Pagamentos por transferência da conta corrente (decisão do controlador): M-6 a M-2 sempre pagas (5 faturas);
  // M-1 só se já venceu — senão fica fechada, sem pagamento; a aberta (M) nunca é paga. Assim a demo nunca
  // mostra fatura vencida.
  for (let i = HISTORY_MONTHS; i >= 1; i--) {
    const invoiceMonth = addMonthsToYm(openInvoiceMonth, -i);
    const { dueDate } = invoiceDates(invoiceMonth, CARD.closingDay, CARD.dueDay);
    if (i === 1 && dueDate >= today) continue;
    transactions.push({
      type: 'transfer', amount: invoiceTotals.get(invoiceMonth) ?? 0, description: 'Pagamento da fatura do cartão',
      accountKey: 'checking', destinationAccountKey: 'card', categoryName: null, nature: null, status: 'paid',
      dueDate, paidDate: dueDate, invoiceMonth, installmentGroupId: null, installmentNumber: null, installmentTotal: null,
    });
  }

  return { accounts, recurrences, transactions, overdueDescription: 'Internet' };
}
