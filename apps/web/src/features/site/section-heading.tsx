import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Reveal, RevealItem } from './reveal';

/** Abertura de seção: o rótulo pequeno, o título Outfit com o contraste fino/extra-negrito e a frase de apoio. */
export function SectionHeading({ id, eyebrow, title, text, className }: { id: string; eyebrow: string; title: ReactNode; text?: ReactNode; className?: string }) {
  return (
    <Reveal className={cn('max-w-2xl', className)} stagger={0.07}>
      <RevealItem>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">{eyebrow}</p>
      </RevealItem>
      <RevealItem>
        <h2 id={id} className="mt-3 font-display text-[clamp(2rem,5vw,3.5rem)] leading-[1.05] tracking-[-0.03em] [text-wrap:balance]">
          {title}
        </h2>
      </RevealItem>
      {text && (
        <RevealItem>
          <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-muted md:text-lg">{text}</p>
        </RevealItem>
      )}
    </Reveal>
  );
}
