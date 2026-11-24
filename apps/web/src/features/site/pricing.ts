/**
 * Planos e preços do site (sub-projeto 17, S6 e S8). PROVISÓRIOS: o usuário decide os valores no fim do projeto, e
 * trocar um preço é mudar uma linha aqui (o JSON-LD do `index.html` é conferido contra este arquivo por teste).
 * Nenhuma cobrança real existe nesta etapa (S7): os botões levam à demo.
 */
export const PRICES_ARE_PROVISIONAL = true;

export type Billing = 'monthly' | 'yearly';

export type Plan = {
  id: 'free' | 'complete';
  name: string;
  tagline: string;
  /** Valores em centavos, como todo dinheiro no FinControl. */
  monthlyCents: number;
  yearlyCents: number;
  features: string[];
  highlight: boolean;
};

const FREE_FEATURES = [
  'Contas, cartões e faturas',
  'Lançamentos e recorrências',
  'Orçamento e metas',
  'Calendário de contas',
  'Importação de extrato (OFX e CSV)',
  'App instalável no celular',
];

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Grátis',
    tagline: 'O básico do dia a dia, para criar o hábito.',
    monthlyCents: 0,
    yearlyCents: 0,
    features: FREE_FEATURES,
    highlight: false,
  },
  {
    id: 'complete',
    name: 'Completo',
    tagline: 'Tudo do Grátis e as ferramentas mais avançadas.',
    monthlyCents: 990,
    yearlyCents: 9900,
    features: [
      'Tudo do plano Grátis',
      'Assistente de IA',
      'Relatórios em PDF e Excel',
      'Patrimônio',
      'Dívidas com plano de quitação',
      'Empréstimos com a comparação do Banco Central',
      'Avisos no celular',
    ],
    highlight: true,
  },
];

/** Quanto o plano anual sai por mês (arredondado para baixo, para nunca anunciar mais barato do que é). */
export const yearlyPerMonthCents = (plan: Plan) => Math.floor(plan.yearlyCents / 12);

/** Meses de graça no anual em relação a pagar 12 mensalidades. */
export const freeMonthsOnYearly = (plan: Plan) => (plan.monthlyCents > 0 ? Math.round(12 - plan.yearlyCents / plan.monthlyCents) : 0);
