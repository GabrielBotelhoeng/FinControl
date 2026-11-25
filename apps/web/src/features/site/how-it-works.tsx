import { BarChart3, FileUp, Landmark, type LucideIcon } from 'lucide-react';
import { IconTile } from '../../components/ui/icon-tile';
import { PALETTE } from '../../lib/palette';
import { BACKDROPS, FloatingBackdrop } from './floating-backdrop';
import { Reveal, RevealItem } from './reveal';
import { SectionHeading } from './section-heading';

const STEPS: { title: string; text: string; icon: LucideIcon; tint: string }[] = [
  { title: 'Cadastre suas contas', text: 'Conta corrente, poupança, carteira e cartões de crédito, cada um com o saldo de hoje.', icon: Landmark, tint: PALETTE.sky },
  { title: 'Lance ou importe o extrato', text: 'Anote um gasto em segundos ou traga o extrato do banco em OFX ou CSV.', icon: FileUp, tint: PALETTE.tangerine },
  { title: 'Veja para onde vai o dinheiro', text: 'O painel mostra o saldo, as categorias que mais pesam e o que ainda vence no mês.', icon: BarChart3, tint: PALETTE.grape },
];

/** "Como funciona": três passos numerados que entram em sequência. */
export function HowItWorks() {
  return (
    <section aria-labelledby="como-funciona-titulo" className="relative isolate px-4 py-20 md:px-10 md:py-28">
      <FloatingBackdrop items={BACKDROPS.howItWorks} />
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          id="como-funciona-titulo"
          eyebrow="Como funciona"
          title={
            <>
              <span className="font-extralight">Três passos e o mês</span> <span className="font-extrabold">se organiza.</span>
            </>
          }
        />
        <Reveal as="ol" stagger={0.1} className="mt-12 grid gap-4 md:mt-16 md:grid-cols-3 md:gap-6">
          {STEPS.map((step, i) => (
            <RevealItem as="li" key={step.title} className="relative overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-panel md:p-8">
              <span aria-hidden className="pointer-events-none absolute right-5 top-3 font-display text-7xl font-extralight leading-none text-border">
                {i + 1}
              </span>
              <div className="relative">
                <IconTile icon={step.icon} color={step.tint} size="lg" />
                <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-muted">Passo {i + 1}</p>
                <h3 className="mt-2 font-display text-2xl font-bold tracking-[-0.02em]">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{step.text}</p>
              </div>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
