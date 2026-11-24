/**
 * Capturas reais da demo usadas no site (sub-projeto 17, S9). Geradas por `e2e/tests/site-capturas.spec.ts` e
 * convertidas para WebP em `public/site/` por `scripts/site-images.mjs`. Sem `src`, a moldura mostra um placeholder
 * com a mesma proporção (até as capturas existirem).
 */
export type Capture = { src?: string; alt: string; width: number; height: number };

const phone = (alt: string, src?: string): Capture => ({ src, alt, width: 780, height: 1688 });
const laptop = (alt: string, src?: string): Capture => ({ src, alt, width: 1440, height: 900 });

export const CAPTURES = {
  dashboardPhone: phone('Painel do FinControl no celular, com o saldo no cartão limão e o resumo do mês'),
  transactionsPhone: phone('Lista de lançamentos do mês no celular, com receitas em verde e despesas em vermelho'),
  invoicesPhone: phone('Fatura do cartão de crédito no celular, com as compras do mês e o vencimento'),
  payoffPhone: phone('Plano de quitação de dívidas no celular, com a ordem de pagamento sugerida'),
  reportsPhone: phone('Relatórios no celular, com gráficos de gastos por categoria'),
  assistantPhone: phone('Assistente de IA no celular respondendo uma pergunta sobre os gastos'),
  dashboardDesktop: laptop('Painel do FinControl no computador, com saldo, gráficos e próximos vencimentos'),
  reportsDesktop: laptop('Relatórios do FinControl no computador, com gráficos e exportação em PDF e Excel'),
} satisfies Record<string, Capture>;
