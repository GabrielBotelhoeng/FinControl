import { Fragment } from 'react';
import { cn } from '../../lib/cn';

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

/** Os termos da faixa de trás (sub-projeto 20, V5): diferentes dos da frente. */
export const MARQUEE_BACK_ITEMS = [
  'Sem planilha',
  'Funciona no celular',
  'Seus dados no Brasil',
  'Grátis para começar',
  'Importe o extrato',
  'Avisos de vencimento',
];

function Track({ items, hidden, back }: { items: string[]; hidden?: boolean; back?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined} className={cn('site-marquee-track flex shrink-0 items-center', back && 'site-marquee-track-back')}>
      {items.map((label) => (
        <Fragment key={label}>
          <li
            className={cn(
              'whitespace-nowrap font-display font-semibold tracking-[-0.01em] md:px-7',
              back ? 'px-3 text-sm md:text-2xl' : 'px-4 text-lg md:text-3xl',
            )}
          >
            {label}
          </li>
          <li aria-hidden className={cn('shrink-0 rounded-full', back ? 'h-2 w-2 bg-surface md:h-2.5 md:w-2.5' : 'h-2.5 w-2.5 bg-brand-fg md:h-3 md:w-3')} />
        </Fragment>
      ))}
    </ul>
  );
}

/**
 * Duas faixas rolantes em X (S12 e sub-projeto 20, V5): a limão na frente, inclinada para um lado e indo para a
 * esquerda, e a verde-folha atrás, com a inclinação oposta e indo para a direita. Em cada uma, a primeira lista é lida
 * uma vez pelo leitor de tela e a cópia que fecha o laço fica `aria-hidden`. A animação é CSS (compositor), as duas
 * param com o mouse em cima da seção e somem com `prefers-reduced-motion`. A seção corta o que passa da largura (sem
 * rolagem horizontal a 360 px). No celular, as duas se encontram na ponta esquerda e se afastam para a direita (68 px no
 * centro): um X cruzado no meio esconderia o texto da de trás numa tela de 360 px.
 */
export function Marquee() {
  return (
    <section aria-label="O que o FinControl faz" className="site-marquees relative isolate overflow-hidden pb-28 pt-14 md:py-20">
      <div className="site-marquee absolute left-[-6%] top-[154px] flex w-[112%] -translate-y-1/2 rotate-[9deg] overflow-hidden bg-primary py-3 md:top-1/2 md:rotate-3 text-surface md:py-4">
        <Track items={MARQUEE_BACK_ITEMS} back />
        <Track items={MARQUEE_BACK_ITEMS} back hidden />
      </div>
      <div className="site-marquee relative -ml-[6%] flex w-[112%] -rotate-3 overflow-hidden md:-rotate-2 bg-brand py-4 text-brand-fg shadow-bar md:py-5">
        <Track items={MARQUEE_ITEMS} />
        <Track items={MARQUEE_ITEMS} hidden />
      </div>
    </section>
  );
}
