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
};

export type FloatItem =
  | (Base & { kind: 'blob'; color: string; size: string })
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
        item.phone ? (item.kind === 'blob' ? '' : 'max-md:opacity-70') : 'max-md:hidden',
        item.kind === 'icon' && 'opacity-80',
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

/** Cor de apoio com transparência, para os blobs (até 0,25: passam atrás de texto, V4). */
const soft = (hex: string, alpha: number) => `${hex}${Math.floor(Math.min(alpha, 0.25) * 255).toString(16).padStart(2, '0')}`;

/** Onde fica cada elemento, por área do site. No computador até 8 por área; no celular até 4 (V3). */
export const BACKDROPS = {
  hero: [
    { kind: 'blob', color: soft(PALETTE.sky, 0.22), size: 'h-64 w-64', at: 'left-[34%] top-[4%]', drift: 'b', seconds: 14 },
    { kind: 'blob', color: soft(PALETTE.tangerine, 0.2), size: 'h-44 w-44', at: '-right-12 top-[26%]', phone: true, drift: 'c', seconds: 12, offset: 4 },
    { kind: 'coin', tone: 'banana', at: 'right-[5%] top-[8%] md:left-[45%] md:right-auto md:top-[16%]', phone: true, tilt: 'rotate-12', drift: 'a', seconds: 7 },
    { kind: 'coin', tone: 'tangerine', at: 'right-[3%] top-[58%]', drift: 'b', seconds: 9, offset: 3 },
    { kind: 'icon', icon: PiggyBank, color: PALETTE.pink, at: 'left-[2%] top-[52%] md:left-[49%] md:top-auto md:bottom-[14%]', phone: true, tilt: '-rotate-6', drift: 'c', seconds: 8, offset: 2 },
    { kind: 'icon', icon: Target, color: PALETTE.grape, at: 'left-[3%] top-[86%] md:left-[58%] md:top-[9%]', phone: true, tilt: 'rotate-6', drift: 'a', seconds: 10, offset: 5 },
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
    { kind: 'coin', tone: 'banana', at: 'right-[5%] top-[1.5%] md:right-[18%] md:top-[3%]', phone: true, tilt: 'rotate-12', drift: 'c', seconds: 8, offset: 2 },
    { kind: 'icon', icon: CreditCard, color: PALETTE.tangerine, at: 'left-[46%] top-[20%]', tilt: '-rotate-6', drift: 'b', seconds: 9 },
    { kind: 'coin', tone: 'tangerine', at: 'left-[1.5%] top-[36%]', drift: 'a', seconds: 7, offset: 3 },
    { kind: 'icon', icon: ChartPie, color: PALETTE.grape, at: 'left-[47%] top-[46%]', tilt: 'rotate-6', drift: 'c', seconds: 11, offset: 4 },
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

/**
 * Elementos flutuando no fundo de uma seção (sub-projeto 20, V1–V4): blobs, moedas, ícones do app e mini-cartões de
 * lançamento, `aria-hidden` e sem receber toque, atrás do conteúdo. A seção precisa de `relative isolate`. Cada um
 * flutua em CSS (só `transform`, no compositor); no computador, a camada acompanha a rolagem com um paralaxe leve. Com
 * `prefers-reduced-motion`, tudo parado; fora da tela, a flutuação pausa. No build e na hidratação, o mesmo HTML para
 * todo mundo (sub-projeto 18): posição absoluta e tamanho fixo, sem CLS.
 */
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
 * `prefers-reduced-motion`, tudo parado; fora da tela, a flutuação pausa. No build e na hidratação, o mesmo HTML para
 * todo mundo (sub-projeto 18, sem paralaxe): posição absoluta e tamanho fixo, sem CLS.
 */
export function FloatingBackdrop({ items }: { items: readonly FloatItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useSiteReducedMotion();
  const desktop = useIsDesktop();
  // Os elementos entram no quadro depois da montagem (ou da hidratação), numa transição do React e com um fade (CSS): o
  // HTML estático fica menor, o LCP não espera por eles e a hidratação não ganha trabalho. A camada já vem no HTML; como
  // tudo é absoluto, nada se mexe (CLS 0) e a hidratação vê o mesmo HTML.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => startTransition(() => setShown(true)));
    return () => cancelAnimationFrame(frame);
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
