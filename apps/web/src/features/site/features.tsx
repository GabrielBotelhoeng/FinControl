import { Bot, CreditCard, FileBarChart, LayoutDashboard, ListChecks, TrendingDown, type LucideIcon } from 'lucide-react';
import { useInView } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useRef, useState } from 'react';
import { IconTile } from '../../components/ui/icon-tile';
import { PALETTE } from '../../lib/palette';
import { CAPTURES, type Capture } from './captures';
import { PhoneFrame } from './device-frame';
import { BACKDROPS, FloatingBackdrop } from './floating-backdrop';
import { EASE_OUT, Reveal, RevealItem, useSiteReducedMotion } from './reveal';
import { SectionHeading } from './section-heading';
import { useIsDesktop } from './use-is-desktop';

type Feature = { title: string; text: string; icon: LucideIcon; tint: string; capture: Capture };

export const FEATURES: Feature[] = [
  {
    title: 'Painel',
    text: 'O saldo de todas as contas, o que entrou e saiu no mês, os gastos por categoria e os próximos vencimentos, numa tela só.',
    icon: LayoutDashboard,
    tint: PALETTE.lime,
    capture: CAPTURES.dashboardPhone,
  },
  {
    title: 'Lançamentos',
    text: 'Receitas, despesas e transferências com categoria, tag e recorrência. O que se repete todo mês entra sozinho.',
    icon: ListChecks,
    tint: PALETTE.sky,
    capture: CAPTURES.transactionsPhone,
  },
  {
    title: 'Cartões e faturas',
    text: 'Cada compra cai na fatura certa, com o limite usado, o fechamento e o vencimento. Pagar a fatura é uma transferência.',
    icon: CreditCard,
    tint: PALETTE.tangerine,
    capture: CAPTURES.invoicesPhone,
  },
  {
    title: 'Dívidas e plano de quitação',
    text: 'Liste o que deve e veja a ordem para pagar, pelo método bola de neve ou avalanche, com a data em que tudo acaba.',
    icon: TrendingDown,
    tint: PALETTE.pink,
    capture: CAPTURES.payoffPhone,
  },
  {
    title: 'Relatórios',
    text: 'Gráficos do mês e do ano e a exportação em PDF, Excel e CSV, para guardar ou mandar para quem precisa.',
    icon: FileBarChart,
    tint: PALETTE.grape,
    capture: CAPTURES.reportsPhone,
  },
  {
    title: 'Assistente',
    text: 'Pergunte em português, do seu jeito: "quanto gastei com mercado este mês?". O assistente responde com os seus números.',
    icon: Bot,
    tint: PALETTE.teal,
    capture: CAPTURES.assistantPhone,
  },
];

/** Um bloco de texto da coluna rolante: avisa quando passa pelo meio da tela para a tela presa trocar. */
function FeatureText({ feature, index, onActive }: { feature: Feature; index: number; onActive: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '-45% 0px -45% 0px' });
  useEffect(() => {
    if (inView) onActive(index);
  }, [inView, index, onActive]);
  return (
    <div ref={ref} className="flex min-h-[72vh] flex-col justify-center">
      <IconTile icon={feature.icon} color={feature.tint} size="lg" />
      <h3 className="mt-5 font-display text-4xl font-bold tracking-[-0.025em]">{feature.title}</h3>
      <p className="mt-3 max-w-[42ch] text-lg leading-relaxed text-muted">{feature.text}</p>
    </div>
  );
}

/**
 * Recursos (seção 3.5): no computador, o texto rola à esquerda e o celular fica preso à direita, trocando a tela com
 * fade e escala 0,98 → 1 conforme o recurso em vista; no celular, cada recurso é um cartão com a captura embaixo.
 */
export function Features() {
  const [active, setActive] = useState(0);
  // Monta só a versão da largura atual, em vez das duas com uma escondida por CSS: 6 molduras a menos no commit.
  const desktop = useIsDesktop();
  const reduce = useSiteReducedMotion();

  return (
    <section id="recursos" aria-labelledby="recursos-titulo" className="relative isolate px-4 py-20 md:px-10 md:py-28">
      <FloatingBackdrop items={BACKDROPS.features} />
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          id="recursos-titulo"
          eyebrow="Recursos"
          title={
            <>
              <span className="font-extralight">Tudo o que o seu dinheiro</span> <span className="font-extrabold">precisa.</span>
            </>
          }
          text="Do gasto do almoço ao plano para sair das dívidas. Sem planilha, sem fórmula."
        />

        {/* Computador: coluna de texto rolando e a tela presa ao lado. */}
        {desktop && (
          <div className="mt-6 grid grid-cols-[1fr_minmax(0,380px)] gap-16 lg:gap-24">
            <div>
              {FEATURES.map((f, i) => (
                <FeatureText key={f.title} feature={f} index={i} onActive={setActive} />
              ))}
            </div>
            <div className="sticky top-24 flex h-[calc(100vh-7rem)] items-center">
              <div className="relative w-full">
                {/* Uma tela de cada vez; as outras ficam escondidas do leitor de tela. */}
                <div className="invisible" aria-hidden>
                  <PhoneFrame capture={{ ...FEATURES[0]!.capture, src: undefined }} className="mx-auto w-[86%]" />
                </div>
                {FEATURES.map((f, i) => (
                  <m.div
                    key={f.title}
                    aria-hidden={i !== active}
                    className="absolute inset-0"
                    initial={false}
                    animate={{ opacity: i === active ? 1 : 0, scale: i === active || reduce ? 1 : 0.98 }}
                    transition={{ duration: 0.45, ease: EASE_OUT }}
                  >
                    <PhoneFrame capture={f.capture} className="mx-auto w-[86%]" />
                  </m.div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/*
          Celular: um cartão por recurso, com a captura embaixo do texto. Cada cartão se revela sozinho: a lista inteira
          passa de 3.200 px a 360 px, e 20% dela nunca caberia na tela de uma vez (CodeRabbit, PR #39).
        */}
        {!desktop && (
          <ul className="mt-10 grid gap-5">
            {FEATURES.map((f) => (
              <Reveal as="li" key={f.title}>
                <RevealItem className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-panel">
                  <IconTile icon={f.icon} color={f.tint} />
                  <h3 className="mt-4 font-display text-2xl font-bold tracking-[-0.02em]">{f.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{f.text}</p>
                  <PhoneFrame capture={f.capture} className="mx-auto -mb-28 mt-6 w-[72%]" />
                </RevealItem>
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
