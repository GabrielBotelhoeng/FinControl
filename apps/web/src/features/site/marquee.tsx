import { Fragment } from 'react';

export const MARQUEE_ITEMS = [
  'Contas e cartões',
  'Faturas',
  'Orçamento',
  'Metas',
  'Calendário',
  'Importar extrato',
  'Relatórios em PDF e Excel',
  'Assistente de IA',
  'Funciona no celular',
];

function Track({ hidden }: { hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined} className="site-marquee-track flex shrink-0 items-center">
      {MARQUEE_ITEMS.map((label) => (
        <Fragment key={label}>
          <li className="whitespace-nowrap px-5 font-display text-xl font-semibold tracking-[-0.01em] md:px-7 md:text-3xl">{label}</li>
          <li aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-fg md:h-3 md:w-3" />
        </Fragment>
      ))}
    </ul>
  );
}

/**
 * Faixa limão rolante, levemente inclinada (S12): a primeira lista é lida uma vez pelo leitor de tela, a cópia que
 * fecha o laço fica `aria-hidden`. A animação é CSS (compositor), para no hover e some com `prefers-reduced-motion`.
 */
export function Marquee() {
  return (
    <section aria-label="O que o FinControl faz" className="relative py-10 md:py-16">
      <div className="site-marquee -ml-[6%] flex w-[112%] -rotate-2 overflow-hidden bg-brand py-4 text-brand-fg shadow-bar md:py-5">
        <Track />
        <Track hidden />
      </div>
    </section>
  );
}
