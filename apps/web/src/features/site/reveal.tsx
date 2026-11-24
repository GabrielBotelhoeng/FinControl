import { useReducedMotion, type Variants } from 'motion/react';
import * as m from 'motion/react-m';
import type { ElementType, ReactNode } from 'react';

/** Curva de saída forte (ease-out "expo"): começa rápido e assenta devagar, sem quique. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const container = (stagger: number): Variants => ({ hidden: {}, show: { transition: { staggerChildren: stagger } } });

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT } },
};

type Tag = 'div' | 'ul' | 'ol' | 'li' | 'section' | 'article';

/**
 * Revela os filhos `RevealItem` em sequência quando o bloco entra na tela (uma vez, a partir de 20% visível),
 * subindo 24 px com opacidade. Com `prefers-reduced-motion`, tudo já aparece parado, no lugar (S4 e seção 4 da spec).
 */
export function Reveal({ as = 'div', stagger = 0.08, className, children }: { as?: Tag; stagger?: number; className?: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) {
    const Plain = as as ElementType;
    return <Plain className={className}>{children}</Plain>;
  }
  const Motion = m[as] as ElementType;
  return (
    <Motion className={className} variants={container(stagger)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
      {children}
    </Motion>
  );
}

/** Um filho de `Reveal`: herda o momento de entrar do pai. */
export function RevealItem({ as = 'div', className, children }: { as?: Tag; className?: string; children: ReactNode }) {
  const reduce = useReducedMotion();
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
