import { useReducedMotion, type Variants } from 'motion/react';
import * as m from 'motion/react-m';
import { useLayoutEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { useBornFromStaticHtml, useHydrated } from '../../lib/hydration';

/** Curva de saída forte (ease-out "expo"): começa rápido e assenta devagar, sem quique. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const container = (stagger: number): Variants => ({ hidden: {}, show: { transition: { staggerChildren: stagger } } });

const item: Variants = {
  // Esconder é instantâneo: só acontece fora da tela, logo depois da hidratação (E4).
  hidden: { opacity: 0, y: 24, transition: { duration: 0 } },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT } },
};

/**
 * O `prefers-reduced-motion` do site, mas `false` no build e na hidratação: o HTML gerado é o mesmo para todo mundo, e o
 * cliente precisa hidratar o mesmo HTML. Logo depois da hidratação, vale a preferência de verdade (sub-projeto 18, E4).
 */
export function useSiteReducedMotion(): boolean {
  const reduce = useReducedMotion();
  return useHydrated() ? Boolean(reduce) : false;
}

/** O bloco está abaixo da dobra? Medido antes da pintura, logo depois da hidratação. */
const belowTheFold = (element: Element | null) => !!element && element.getBoundingClientRect().top > window.innerHeight;

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

type Tag = 'div' | 'ul' | 'ol' | 'li' | 'section' | 'article';

/**
 * Revela os filhos `RevealItem` em sequência quando o bloco entra na tela (uma vez, a partir de 20% visível),
 * subindo 24 px com opacidade. Com `prefers-reduced-motion`, tudo já aparece parado, no lugar (S4 e seção 4 da spec).
 *
 * Vindo do HTML estático (sub-projeto 18, E4), o bloco nasce visível, como no servidor, e só se esconde para animar se
 * estiver abaixo da dobra (decidido no `useLayoutEffect`, antes da pintura). O que já está na tela não se mexe.
 */
export function Reveal({ as = 'div', stagger = 0.08, className, children }: { as?: Tag; stagger?: number; className?: string; children: ReactNode }) {
  const reduce = useSiteReducedMotion();
  const bornStatic = useBornFromStaticHtml();
  const ref = useRef<HTMLElement>(null);
  const [hideUntilInView, setHideUntilInView] = useState(false);
  useLayoutEffect(() => {
    if (bornStatic && !prefersReducedMotion() && belowTheFold(ref.current)) setHideUntilInView(true);
  }, [bornStatic]);

  if (reduce) {
    const Plain = as as ElementType;
    return <Plain className={className}>{children}</Plain>;
  }
  const Motion = m[as] as ElementType;
  const variants = container(stagger);
  const viewport = { once: true, amount: 0.2 };
  if (bornStatic) {
    return (
      <Motion
        ref={ref}
        className={className}
        variants={variants}
        initial={false}
        animate={hideUntilInView ? 'hidden' : 'show'}
        whileInView={hideUntilInView ? 'show' : undefined}
        viewport={viewport}
      >
        {children}
      </Motion>
    );
  }
  return (
    <Motion ref={ref} className={className} variants={variants} initial="hidden" whileInView="show" viewport={viewport}>
      {children}
    </Motion>
  );
}

/** Um filho de `Reveal`: herda o momento de entrar do pai. */
export function RevealItem({ as = 'div', className, children }: { as?: Tag; className?: string; children: ReactNode }) {
  const reduce = useSiteReducedMotion();
  if (reduce) {
    const Plain = as as ElementType;
    return <Plain className={className}>{children}</Plain>;
  }
  const Motion = m[as] as ElementType;
  return (
    <Motion className={className} variants={item}>
      {children}
    </Motion>
  );
}
