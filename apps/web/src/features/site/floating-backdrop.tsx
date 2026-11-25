import { CalendarDays, ChartPie, CreditCard, PiggyBank, Receipt, Target, Wallet, type LucideIcon } from 'lucide-react';
import { useScroll, useTransform } from 'motion/react';
import * as m from 'motion/react-m';
import { startTransition, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { IconTile } from '../../components/ui/icon-tile';
import { cn } from '../../lib/cn';
import { PALETTE } from '../../lib/palette';
import { useSiteReducedMotion } from './reveal';
import { useIsDesktop } from './use-is-desktop';

/** Três caminhos de flutuação (só `translate` e `rotate`), para os vizinhos não andarem juntos. */
type Drift = 'a' | 'b' | 'c';

type Base = {
  /** Posição dentro da seção (classes do Tailwind: `left-[4%] top-[12%]`). */
  at: string;
  /** Também aparece no celular (< 768 px), menor e mais transparente. Sem isso, só no computador. */
  phone?: boolean;
  drift: Drift;
  /** Duração do ciclo em segundos (6 a 14) e o quanto ele já começa adiantado, para não sincronizar. */
  seconds: number;
  offset?: number;
  /** Maior (×1,4): ícones de 56 px e moedas de 67 px no computador, ~45–50 px no celular. Para o herói chamar atenção. */
  big?: boolean;
};

export type FloatItem =
  /** `clear`: a mancha nunca fica atrás de texto, então pode ser mais forte (alfa até 0,45). */
  | (Base & { kind: 'blob'; color: string; size: string; clear?: boolean })
  | (Base & { kind: 'coin'; tone: 'tangerine' | 'banana'; tilt?: string })
  | (Base & { kind: 'icon'; icon: LucideIcon; color: string; tilt?: string })
  | (Base & { kind: 'chip'; icon: LucideIcon; color: string; name: string; amount: string; tilt?: string })
  | (Base & { kind: 'ticker'; notes: Note[] });

/** Um aviso da coluna que sobe devagar (como os do app). */
type Note = { icon: LucideIcon; color: string; title: string; detail: string };

/**
 * Coluna estreita de avisos subindo devagar, como o "Vertical Scroll" do Marquee do spell.sh (sub-projeto 20): a lista
 * vai duas vezes, e a coluna sobe metade da própria altura em laço (só `transform`). As pontas somem num degradê
 * (`mask-image`). Só no computador.
 */
function Ticker({ notes, still }: { notes: Note[]; still: boolean }) {
  const list = (hidden?: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex flex-col gap-2.5 pb-2.5">
      {notes.map((n) => (
        <li key={n.title} className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface py-2 pl-2 pr-3.5 shadow-bar">
          <IconTile icon={n.icon} color={n.color} size="sm" />
          <span>
            <span className="block whitespace-nowrap text-xs font-semibold text-text">{n.title}</span>
            <span className="block whitespace-nowrap text-[11px] text-muted">{n.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
  return (
    <span className="block h-44 w-56 overflow-hidden [mask-image:linear-gradient(transparent,#000_22%,#000_78%,transparent)]">
      <span className={cn('block', !still && 'site-ticker')}>
        {list()}
        {list(true)}
      </span>
    </span>
  );
}

/** Moeda: o "R$" vem do CSS (`content`), é só desenho, sem texto para o leitor de tela nem para a auditoria de contraste. */
function Coin({ tone }: { tone: 'tangerine' | 'banana' }) {
  return (
    <span
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full font-display text-[11px] font-extrabold tracking-[-0.02em] text-brand-fg shadow-[inset_0_-3px_0_rgb(20_23_15/0.14),0_10px_20px_-10px_rgb(20_23_15/0.45)] after:content-['R$'] md:h-12 md:w-12 md:text-sm",
        tone === 'banana' ? 'bg-banana' : 'bg-tangerine',
      )}
    />
  );
}

/** Um lançamento de exemplo, como os do herói (só no computador, nunca atrás de texto). */
function Chip({ icon, color, name, amount }: { icon: LucideIcon; color: string; name: string; amount: string }) {
  return (
    <span className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface py-2 pl-2 pr-3.5 shadow-bar">
      <IconTile icon={icon} color={color} size="sm" />
      <span>
        <span className="block whitespace-nowrap text-xs font-semibold text-text">{name}</span>
        <span className="tabular block whitespace-nowrap text-xs font-semibold text-expense">{amount}</span>
      </span>
    </span>
  );
}

function Item({ item, still }: { item: FloatItem; still: boolean }) {
  const drift: CSSProperties = { animationDuration: `${item.seconds}s`, animationDelay: `${-(item.offset ?? 0)}s` };
  const tilt = item.kind === 'blob' || item.kind === 'ticker' ? undefined : item.tilt;
  return (
    <span
      data-float={item.kind}
      className={cn(
        'absolute',
        item.at,
        // No celular: só os marcados, menores e mais transparentes, sempre nas bordas, fora do texto (V3 e V4).
        item.phone ? (item.kind === 'blob' ? '' : 'max-md:opacity-90') : 'max-md:hidden',
        item.kind === 'icon' && 'opacity-90',
        item.big && 'scale-[1.4]',
        tilt,
      )}
    >
      <span className={cn('block', !still && item.kind !== 'ticker' && `site-drift site-drift-${item.drift}`)} style={drift}>
        {item.kind === 'blob' && (
          <span className={cn('block rounded-full', item.size)} style={{ background: `radial-gradient(closest-side, ${item.color}, transparent)` }} />
        )}
        {item.kind === 'coin' && <Coin tone={item.tone} />}
        {item.kind === 'icon' && <IconTile icon={item.icon} color={item.color} className="max-md:h-8 max-md:w-8 max-md:rounded-[10px]" />}
        {item.kind === 'chip' && <Chip icon={item.icon} color={item.color} name={item.name} amount={item.amount} />}
        {item.kind === 'ticker' && <Ticker notes={item.notes} still={still} />}
      </span>
    </span>
  );
}

/** Cor de apoio com transparência, para os blobs: até 0,25 quando passam atrás de texto (V4), até 0,45 quando não. */
const soft = (hex: string, alpha: number, max = 0.25) => `${hex}${Math.floor(Math.min(alpha, max) * 255).toString(16).padStart(2, '0')}`;

/** Onde fica cada elemento, por área do site. No computador até 8 por área; no celular até 4 (V3). */
export const BACKDROPS = {
  hero: [
    { kind: 'blob', color: soft(PALETTE.sky, 0.22), size: 'h-64 w-64', at: 'left-[34%] top-[4%]', drift: 'b', seconds: 14 },
    { kind: 'blob', color: soft(PALETTE.tangerine, 0.4, 0.45), size: 'h-96 w-96', at: '-right-16 top-[18%]', clear: true, drift: 'c', seconds: 12, offset: 4 },
    { kind: 'coin', tone: 'banana', at: 'right-[6%] top-[8%] md:left-[45%] md:right-auto md:top-[16%]', phone: true, big: true, tilt: 'rotate-12', drift: 'a', seconds: 7 },
    { kind: 'coin', tone: 'tangerine', at: 'right-[3%] top-[73%] md:right-[3%] md:top-[58%]', phone: true, big: true, drift: 'b', seconds: 9, offset: 3 },
    { kind: 'icon', icon: PiggyBank, color: PALETTE.pink, at: 'left-[1%] top-[57%] md:left-[49%] md:top-auto md:bottom-[14%]', phone: true, big: true, tilt: '-rotate-6', drift: 'c', seconds: 8, offset: 2 },
    { kind: 'icon', icon: Target, color: PALETTE.grape, at: 'left-[4%] top-[85%] md:left-[58%] md:top-[9%]', phone: true, big: true, tilt: 'rotate-6', drift: 'a', seconds: 10, offset: 5 },
    { kind: 'icon', icon: CreditCard, color: PALETTE.sky, at: 'right-[5%] top-[11%]', big: true, tilt: '-rotate-6', drift: 'b', seconds: 11, offset: 1 },
    { kind: 'icon', icon: ChartPie, color: PALETTE.teal, at: 'left-[52%] top-[44%]', big: true, tilt: 'rotate-3', drift: 'c', seconds: 9, offset: 6 },
  ],
  howItWorks: [
    { kind: 'blob', color: soft(PALETTE.lime, 0.25), size: 'h-72 w-72', at: 'right-[12%] -top-16', drift: 'c', seconds: 13 },
    { kind: 'coin', tone: 'tangerine', at: 'right-[5%] top-[3%] md:right-[9%] md:top-[12%]', phone: true, tilt: '-rotate-12', drift: 'b', seconds: 8 },
    { kind: 'icon', icon: CalendarDays, color: PALETTE.sky, at: 'right-[24%] top-[6%]', tilt: 'rotate-6', drift: 'a', seconds: 9, offset: 3 },
    { kind: 'icon', icon: Wallet, color: PALETTE.teal, at: 'left-[3%] bottom-[2%] md:left-[30%] md:bottom-[3%]', phone: true, tilt: '-rotate-6', drift: 'c', seconds: 11, offset: 2 },
    {
      kind: 'ticker',
      at: 'left-[47%] top-[3%]',
      drift: 'a',
      seconds: 10,
      notes: [
        { icon: Receipt, color: PALETTE.indigo, title: 'Conta de luz vence amanhã', detail: 'R$ 182,40 · Calendário' },
        { icon: Target, color: PALETTE.grape, title: 'Meta de viagem em 60%', detail: 'Faltam R$ 1.200,00' },
        { icon: Wallet, color: PALETTE.teal, title: 'Salário + R$ 5.070,00', detail: 'Conta corrente · hoje' },
        { icon: CreditCard, color: PALETTE.tangerine, title: 'Fatura fecha em 3 dias', detail: 'Cartão principal' },
      ],
    },
  ],
  features: [
    { kind: 'blob', color: soft(PALETTE.grape, 0.16), size: 'h-72 w-72', at: '-left-24 top-[1%] md:left-[30%] md:-top-10', phone: true, drift: 'a', seconds: 14 },
    { kind: 'coin', tone: 'banana', at: 'right-[5%] top-[1.5%] md:left-[54%] md:right-auto md:top-[2.5%]', phone: true, big: true, tilt: 'rotate-12', drift: 'c', seconds: 8, offset: 2 },
    { kind: 'icon', icon: CreditCard, color: PALETTE.tangerine, at: 'left-[46%] top-[6%]', big: true, tilt: '-rotate-6', drift: 'b', seconds: 9 },
    { kind: 'coin', tone: 'tangerine', at: 'left-[1.5%] top-[36%]', drift: 'a', seconds: 7, offset: 3 },
    { kind: 'icon', icon: ChartPie, color: PALETTE.grape, at: 'left-[58%] top-[9%]', tilt: 'rotate-6', drift: 'c', seconds: 11, offset: 4 },
    { kind: 'icon', icon: PiggyBank, color: PALETTE.pink, at: 'right-[2%] top-[58%]', tilt: '-rotate-3', drift: 'a', seconds: 10, offset: 1 },
    { kind: 'coin', tone: 'banana', at: 'left-[45%] top-[74%]', drift: 'b', seconds: 8, offset: 5 },
    { kind: 'icon', icon: Target, color: PALETTE.sky, at: 'left-[1.5%] top-[86%]', tilt: 'rotate-6', drift: 'c', seconds: 12, offset: 2 },
  ],
  mobileApp: [
    { kind: 'blob', color: soft(PALETTE.lime, 0.25), size: 'h-80 w-80', at: 'right-[8%] top-[6%]', drift: 'a', seconds: 14 },
    { kind: 'coin', tone: 'banana', at: 'right-[5%] top-[2%] md:left-[45%] md:right-auto md:top-[10%]', phone: true, tilt: '-rotate-12', drift: 'b', seconds: 8 },
    { kind: 'chip', icon: Wallet, color: PALETTE.teal, name: 'Feira', amount: '− R$ 48,90', at: 'right-[3%] top-[7%]', tilt: '-rotate-2', drift: 'c', seconds: 10, offset: 3 },
    { kind: 'icon', icon: CalendarDays, color: PALETTE.grape, at: 'left-[4%] top-[1%] md:left-[46%] md:top-auto md:bottom-[12%]', phone: true, tilt: 'rotate-6', drift: 'a', seconds: 9, offset: 2 },
    { kind: 'icon', icon: ChartPie, color: PALETTE.sky, at: 'right-[4%] bottom-[8%]', tilt: '-rotate-6', drift: 'b', seconds: 11, offset: 5 },
  ],
} satisfies Record<string, FloatItem[]>;

/** As duas camadas, longe (blobs) e perto (o resto), paradas: no celular e com `prefers-reduced-motion`. */
function StillLayers({ far, near, still }: { far: FloatItem[]; near: FloatItem[]; still: boolean }) {
  return (
    <>
      <div className="absolute inset-0">
        {far.map((item, i) => (
          <Item key={i} item={item} still={still} />
        ))}
      </div>
      <div className="absolute inset-0">
        {near.map((item, i) => (
          <Item key={i} item={item} still={still} />
        ))}
      </div>
    </>
  );
}

/**
 * As mesmas camadas com o paralaxe do computador: os blobs (longe) andam menos que as moedas e os ícones (perto),
 * profundidade sem 3D. Só monta no computador, para o celular não medir a rolagem à toa (Lighthouse no celular).
 */
function ParallaxLayers({ target, far, near }: { target: RefObject<HTMLDivElement | null>; far: FloatItem[]; near: FloatItem[] }) {
  const { scrollYProgress } = useScroll({ target, offset: ['start end', 'end start'] });
  const farY = useTransform(scrollYProgress, [0, 1], [24, -24]);
  const nearY = useTransform(scrollYProgress, [0, 1], [60, -60]);
  return (
    <>
      <m.div className="absolute inset-0" style={{ y: farY }}>
        {far.map((item, i) => (
          <Item key={i} item={item} still={false} />
        ))}
      </m.div>
      <m.div className="absolute inset-0" style={{ y: nearY }}>
        {near.map((item, i) => (
          <Item key={i} item={item} still={false} />
        ))}
      </m.div>
    </>
  );
}

/**
 * Elementos flutuando no fundo de uma seção (sub-projeto 20, V1–V4): blobs, moedas, ícones do app e mini-cartões de
 * lançamento, `aria-hidden` e sem receber toque, atrás do conteúdo. A seção precisa de `relative isolate`. Cada um
 * flutua em CSS (só `transform`, no compositor); no computador, a camada acompanha a rolagem com um paralaxe leve. Com
 * `prefers-reduced-motion`, tudo parado; fora da tela, a flutuação pausa.
 *
 * HTML estático (sub-projeto 18; V9 da spec, revisado): de propósito, o build gera só o contêiner vazio
 * (`[data-backdrop]`, sem nenhum elemento), e os elementos são montados depois do primeiro quadro, para não competir com
 * o LCP (a captura do herói). Medido: com os elementos no HTML, o LCP no celular ia de 1,7 para 1,9 s e o Lighthouse caía
 * para 97–99. Como o servidor e a hidratação desenham o mesmo contêiner vazio (`useIsDesktop` e o movimento reduzido
 * também são `false` lá), não há diferença na hidratação; e, como tudo é absoluto, nada se desloca (CLS 0).
 */
export function FloatingBackdrop({ items }: { items: readonly FloatItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useSiteReducedMotion();
  const desktop = useIsDesktop();
  // Começa sem os elementos (no build, na hidratação e na primeira montagem) e os monta quando a seção chega perto da tela
  // (200 px antes), numa transição do React e com um fade de opacidade (CSS): o LCP não espera por eles, a hidratação não
  // ganha trabalho e o que está abaixo da dobra não pesa na carga. Sem `IntersectionObserver`, no quadro seguinte.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    const show = () => startTransition(() => setShown(true));
    if (!el || typeof IntersectionObserver === 'undefined') {
      const frame = requestAnimationFrame(show);
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        show();
      },
      { rootMargin: '200px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Pausa a flutuação fora da tela (direto no DOM, sem re-render).
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) el.removeAttribute('data-offscreen');
      else el.setAttribute('data-offscreen', '');
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const far = items.filter((i) => i.kind === 'blob');
  const near = items.filter((i) => i.kind !== 'blob');
  return (
    <div ref={ref} aria-hidden data-backdrop className="site-backdrop pointer-events-none absolute inset-0 -z-10 select-none overflow-hidden">
      {!shown ? null : desktop && !reduce ? (
        <ParallaxLayers target={ref} far={far} near={near} />
      ) : (
        <StillLayers far={far} near={near} still={reduce} />
      )}
    </div>
  );
}
