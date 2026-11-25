import { Cloud, Download, Smartphone, type LucideIcon } from 'lucide-react';
import { useScroll, useTransform } from 'motion/react';
import * as m from 'motion/react-m';
import { useRef } from 'react';
import { IconTile } from '../../components/ui/icon-tile';
import { PALETTE } from '../../lib/palette';
import { CAPTURES } from './captures';
import { LaptopFrame, PhoneFrame, TabletFrame } from './device-frame';
import { BACKDROPS, FloatingBackdrop } from './floating-backdrop';
import { Reveal, RevealItem, useSiteReducedMotion } from './reveal';
import { SectionHeading } from './section-heading';

const POINTS: { title: string; text: string; icon: LucideIcon; tint: string }[] = [
  {
    title: 'Instala pela tela inicial',
    text: 'No Android, use "Instalar app" no menu do Chrome; no iPhone, Compartilhar → "Adicionar à Tela de Início". Sem loja de apps.',
    icon: Download,
    tint: PALETTE.lime,
  },
  {
    title: 'Abre como um app',
    text: 'Ícone próprio, tela cheia e a barra embaixo com o "+" para lançar um gasto na fila do mercado.',
    icon: Smartphone,
    tint: PALETTE.sky,
  },
  {
    title: 'Os mesmos dados em todo lugar',
    text: 'Tudo fica salvo na nuvem: o que você lança no celular aparece no computador, e o contrário também.',
    icon: Cloud,
    tint: PALETTE.grape,
  },
];

/**
 * "No celular, como app" (seção 3.6): o notebook ao fundo, o iPad na frente à esquerda e dois celulares na frente à
 * direita (sub-projeto 20, V8), com um paralaxe leve em três profundidades.
 */
export function MobileApp() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useSiteReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  // Paralaxe leve; com `prefers-reduced-motion`, os aparelhos ficam parados.
  const frontY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [50, -50]);
  const midY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [35, -35]);
  const backY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [20, -20]);

  return (
    <section aria-labelledby="celular-titulo" className="relative isolate bg-surface-2/60 px-4 py-20 md:px-10 md:py-28">
      <FloatingBackdrop items={BACKDROPS.mobileApp} />
      <div className="mx-auto grid max-w-7xl items-center gap-14 md:grid-cols-2 md:gap-16">
        <div>
          <SectionHeading
            id="celular-titulo"
            eyebrow="No celular, como app"
            title={
              <>
                <span className="font-extralight">No bolso e na</span> <span className="font-extrabold">mesa.</span>
              </>
            }
            text="O FinControl funciona no navegador e também pode ser instalado no celular, no Android e no iPhone."
          />
          <Reveal as="ul" className="mt-10 grid gap-6">
            {POINTS.map((p) => (
              <RevealItem as="li" key={p.title} className="flex gap-4">
                <IconTile icon={p.icon} color={p.tint} />
                <div>
                  <h3 className="font-display text-xl font-bold tracking-[-0.015em]">{p.title}</h3>
                  <p className="mt-1 leading-relaxed text-muted">{p.text}</p>
                </div>
              </RevealItem>
            ))}
          </Reveal>
        </div>

        <div ref={ref} className="relative mx-auto w-full max-w-[560px] pb-16 pt-4">
          <m.div style={{ y: backY }}>
            <LaptopFrame capture={CAPTURES.dashboardDesktop} className="ml-[17%] w-[80%]" />
          </m.div>
          <m.div style={{ y: midY }} className="absolute bottom-[2%] left-0 w-[26%]">
            <TabletFrame capture={CAPTURES.dashboardTablet} className="-rotate-2" />
          </m.div>
          <m.div style={{ y: frontY }} className="absolute -bottom-2 right-0 flex w-[42%] items-end gap-3">
            <PhoneFrame capture={CAPTURES.transactionsPhone} size="sm" className="w-1/2 -rotate-3" />
            <PhoneFrame capture={CAPTURES.dashboardPhone} size="sm" className="mb-8 w-1/2 rotate-2" />
          </m.div>
        </div>
      </div>
    </section>
  );
}
