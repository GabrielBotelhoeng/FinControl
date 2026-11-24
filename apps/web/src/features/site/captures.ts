/**
 * Capturas reais da demo usadas no site (sub-projeto 17, S9). Geradas por `e2e/tests/site-capturas.spec.ts` e
 * convertidas para WebP em `public/site/` por `scripts/site-images.mjs`. Sem `src`, a moldura mostra um placeholder
 * com a mesma proporção.
 */
export type Capture = { src?: string; alt: string; width: number; height: number; srcSet?: string };

/** Celular: a captura de 780 px e as versões de 420 e 560 px (`-420.webp`, `-560.webp`), escolhidas pelo navegador. */
const phone = (alt: string, src?: string): Capture => ({
  src,
  alt,
  width: 780,
  height: 1688,
  srcSet: src ? [420, 560].map((w) => `${src.replace(/\.webp$/, `-${w}.webp`)} ${w}w`).concat(`${src} 780w`).join(', ') : undefined,
});
const laptop = (alt: string, src?: string): Capture => ({ src, alt, width: 1440, height: 900 });

export const CAPTURES = {
  dashboardPhone: phone('Painel do FinControl no celular, com o saldo no cartão limão e o resumo do mês', '/site/painel-celular.webp'),
  transactionsPhone: phone('Lista de lançamentos do mês no celular, com receitas em verde e despesas em vermelho', '/site/lancamentos-celular.webp'),
  invoicesPhone: phone('Fatura do cartão de crédito no celular, com as compras do mês e o vencimento', '/site/faturas-celular.webp'),
  payoffPhone: phone('Plano de quitação de dívidas no celular, com o saldo devedor caindo até zero e a ordem de pagamento', '/site/quitacao-celular.webp'),
  reportsPhone: phone('Relatórios no celular, com os botões de PDF, Excel e CSV e o resumo de receitas e despesas do mês', '/site/relatorios-celular.webp'),
  assistantPhone: phone('Assistente de IA no celular, com sugestões de perguntas sobre os gastos', '/site/assistente-celular.webp'),
  dashboardDesktop: laptop('Painel do FinControl no computador, com o saldo, as receitas e despesas do mês, os indicadores e o orçamento', '/site/painel-computador.webp'),
  reportsDesktop: laptop('Relatórios do FinControl no computador, com a exportação em PDF, Excel e CSV e o resumo do período', '/site/relatorios-computador.webp'),
} satisfies Record<string, Capture>;
