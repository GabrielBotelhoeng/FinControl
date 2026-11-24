import { Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { cn } from '../../lib/cn';
import { FAQ } from './faq-data';
import { Reveal, RevealItem } from './reveal';
import { SectionHeading } from './section-heading';

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const buttonId = id + '-pergunta';
  const panelId = id + '-resposta';
  return (
    <div className="border-b border-border">
      <h3>
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-6 py-5 text-left font-display text-lg font-semibold tracking-[-0.01em] md:text-xl"
        >
          {question}
          <span
            aria-hidden
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border transition-[transform,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
              open && 'rotate-45 border-transparent bg-brand text-brand-fg',
            )}
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
          </span>
        </button>
      </h3>
      {/* A resposta abre com a altura animada pelo truque do grid (0fr → 1fr); fechada, sai da ordem de foco. */}
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        inert={!open}
        className={cn('grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
      >
        <div className="overflow-hidden">
          <p className={cn('max-w-[62ch] pb-6 leading-relaxed text-muted transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')}>{answer}</p>
        </div>
      </div>
    </div>
  );
}

/** Perguntas (seção 3.9): acordeão acessível por teclado (`button` + `aria-expanded` + `aria-controls`). */
export function Faq() {
  return (
    <section id="perguntas" aria-labelledby="perguntas-titulo" className="px-4 py-20 md:px-10 md:py-28">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
        <SectionHeading
          id="perguntas-titulo"
          eyebrow="Perguntas"
          title={
            <>
              <span className="font-extralight">Antes de</span> <span className="font-extrabold">começar.</span>
            </>
          }
          text="Respostas rápidas sobre o FinControl."
        />
        <Reveal stagger={0.05} className="border-t border-border">
          {FAQ.map((item) => (
            <RevealItem key={item.question}>
              <FaqItem question={item.question} answer={item.answer} />
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
