import { ArrowRight, Briefcase, ShoppingCart, Sparkles, Utensils, Wallet, type LucideIcon } from 'lucide-react';
import { animate, useReducedMotion, useScroll, useTransform } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { IconTile } from '../../components/ui/icon-tile';
import { formatBRL, splitBRL } from '../../lib/format';
import { PALETTE } from '../../lib/palette';
import { CAPTURES } from './captures';
import { useSiteDemo } from './demo-context';
import { PhoneFrame } from './device-frame';
import { EASE_OUT } from './reveal';

/**
 * O saldo da demo na captura do painel (`public/site/painel-celular.webp`): o cartão limão "salta" da tela com o mesmo
 * valor, contando de 0 até ele. Se as capturas forem refeitas e o saldo da demo mudar, atualize aqui.
 */
export const HERO_BALANCE_CENTS = 2135910;

/** Largura da captura do herói na página (`sizes`), repetida no preload de `public/theme-init.js` (teste). */
export const HERO_IMAGE_SIZES = '(min-width: 768px) 265px, 235px';

/**
 * O saldo do cartão limão conta de 0 até o valor; com `prefers-reduced-motion`, já nasce no valor final. Mesmo desenho
 * do `HeroAmount`, mas o número é escrito direto no DOM a cada quadro (sem re-render do React enquanto a página carrega).
 */
function CountingBalance({ cents }: { cents: number }) {
  const reduce = useReducedMotion();
  const integerRef = useRef<HTMLSpanElement>(null);
  const centsRef = useRef<HTMLSpanElement>(null);
  const start = splitBRL(reduce ? cents : 0);
  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, cents, {
      duration: 1.4,
      delay: 0.3,
      ease: EASE_OUT,
      onUpdate: (v) => {
        const parts = splitBRL(Math.round(v));
        if (integerRef.current) integerRef.current.textContent = parts.integer;
        if (centsRef.current) centsRef.current.textContent = parts.cents;
      },
    });
    return () => controls.stop();
  }, [reduce, cents]);
  return (
    <>
      {/* O número que conta é decoração; o leitor de tela ouve o valor final uma vez. */}
      <span aria-hidden className="tabular mt-1 block whitespace-nowrap font-display text-[1.6rem] leading-none tracking-[-0.02em] md:text-4xl">
        <span className="font-extralight">{start.currency} </span>
        <span ref={integerRef} className="font-extrabold">
          {start.integer}
        </span>
        <span ref={centsRef} className="font-extralight">
          {start.cents}
        </span>
      </span>
      <span className="sr-only">{formatBRL(cents)}</span>
    </>
  );
}

type ChipProps = {
  icon: LucideIcon;
  tint: string;
  name: string;
  amount: string;
  kind: 'income' | 'expense';
  className: string;
  delay: number;
  floatClass: string;
};

/** Um lançamento de exemplo: entra com fade e escala 0,95 e depois oscila devagar em CSS (fora do thread principal). */
function FloatingChip({ icon, tint, name, amount, kind, className, delay, floatClass }: ChipProps) {
  const reduce = useReducedMotion();
  const enter = <T,>(from: T) => (reduce ? false : from);
  return (
    <m.div
      className={`absolute ${className}`}
      initial={enter({ opacity: 0, scale: 0.95, y: 8 })}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: EASE_OUT }}
    >
      <div className={`flex items-center gap-2.5 rounded-2xl border border-border bg-surface py-2 pl-2 pr-3.5 shadow-bar ${floatClass}`}>
        <IconTile icon={icon} color={tint} size="sm" />
        <div>
          <p className="whitespace-nowrap text-xs font-semibold text-text">{name}</p>
          <p className={`tabular whitespace-nowrap text-xs font-semibold ${kind === 'income' ? 'text-income' : 'text-expense'}`}>{amount}</p>
        </div>
      </div>
    </m.div>
  );
}

/** Aviso de idade mínima e aceite, como na entrada. */
function AgeNotice() {
  return (
    <p className="max-w-[46ch] text-xs leading-relaxed text-muted">
      Ao continuar, você declara ter 18 anos ou mais e concorda com os{' '}
      <Link to="/termos" className="underline hover:text-text">
        Termos de Uso
      </Link>{' '}
      e a{' '}
      <Link to="/privacidade" className="underline hover:text-text">
        Política de privacidade
      </Link>
      .
    </p>
  );
}

/**
 * Herói (seção 3.2 da spec). O `h1` e o botão principal nunca começam invisíveis (o LCP não espera a animação, S4):
 * eles só sobem alguns pixels. O celular e os cartões acompanham a rolagem com um paralaxe leve.
 */
export function Hero() {
  const demo = useSiteDemo();
  // Com `prefers-reduced-motion`, as entradas do herói nascem paradas, no lugar (sem nem o fade).
  const reduce = useReducedMotion();
  const enter = <T,>(from: T) => (reduce ? false : from);
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  // Paralaxe leve; com `prefers-reduced-motion`, nada acompanha a rolagem.
  const phoneY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, -60]);
  const chipsY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, -130]);

  return (
    <section ref={ref} aria-labelledby="site-titulo" className="relative isolate px-4 pb-6 pt-28 md:px-10 md:pb-10 md:pt-36">
      {/* Brilhos coloridos de fundo, como na entrada: limão, tangerina e uva (estáticos). */}
      {/* Gradientes radiais em vez de `filter: blur` (mesma luz, sem o custo de pintar o desfoque no primeiro quadro). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <span className="absolute -right-48 -top-48 h-[40rem] w-[40rem] rounded-full bg-[radial-gradient(closest-side,rgb(200_242_75/0.6),transparent)]" />
        <span className="absolute -left-52 top-56 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(closest-side,rgb(255_138_61/0.2),transparent)]" />
        <span className="absolute -bottom-24 right-1/4 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(closest-side,rgb(124_92_255/0.15),transparent)]" />
      </div>

      <div className="mx-auto grid max-w-7xl items-center gap-14 md:grid-cols-[1.1fr_0.9fr] md:gap-10">
        <div className="flex flex-col gap-7">
          <m.p
            className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted"
            initial={enter({ opacity: 0 })}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            Planeje <span className="text-primary">·</span> Controle <span className="text-primary">·</span> Realize
          </m.p>
          <m.h1
            id="site-titulo"
            className="font-display text-[clamp(2.75rem,8.5vw,5.75rem)] leading-[1.1] tracking-[-0.03em] [text-wrap:balance]"
            initial={enter({ y: 16 })}
            animate={{ y: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
          >
            <span className="font-extralight">Seu dinheiro,</span>{' '}
            <span className="rounded-2xl bg-brand px-2 font-extrabold text-brand-fg [box-decoration-break:clone]">sob controle.</span>
          </m.h1>
          <m.p
            className="max-w-[44ch] text-base leading-relaxed text-muted md:text-lg"
            initial={enter({ opacity: 0, y: 10 })}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.09, ease: EASE_OUT }}
          >
            Contas, cartões, faturas e metas num lugar só. Saiba quanto entra, quanto sai e o que ainda vence no mês, no celular ou
            no computador.
          </m.p>
          <m.div className="flex flex-col gap-4" initial={enter({ y: 8 })} animate={{ y: 0 }} transition={{ duration: 0.5, delay: 0.16, ease: EASE_OUT }}>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={() => void demo.start()} loading={demo.pending} className="max-sm:w-full">
                {!demo.pending && <Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
                Experimentar sem cadastro
              </Button>
              <Link
                to="/entrar?modo=cadastro"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-full border border-border px-7 text-base font-semibold text-text transition-[background-color,transform] duration-200 hover:bg-surface-2 active:scale-[0.98] max-sm:w-full"
              >
                Criar conta grátis
                <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </Link>
            </div>
            {demo.error && (
              <p role="alert" className="max-w-[46ch] rounded-[var(--radius-control)] bg-expense-soft px-3.5 py-2.5 text-sm text-expense">
                {demo.error}
              </p>
            )}
            <AgeNotice />
          </m.div>
        </div>

        {/* O celular com a captura do painel, o cartão limão do saldo e os lançamentos flutuando em volta. */}
        <div className="relative mx-auto w-full max-w-[340px] md:max-w-[380px]">
          <m.div style={{ y: phoneY }}>
            <m.div
              className="relative mx-auto w-[74%]"
              // A captura do celular é o LCP: como o título, ela só sobe, nunca começa invisível (S4).
              initial={enter({ y: 32 })}
              animate={{ y: 0 }}
              transition={{ duration: 0.7, delay: 0.12, ease: EASE_OUT }}
            >
              {/* A tela tem ~235 px no celular e ~265 px no computador; o mesmo `sizes` vai no preload do theme-init.js. */}
              <PhoneFrame capture={CAPTURES.dashboardPhone} priority sizes={HERO_IMAGE_SIZES} />
              {/*
                O cartão limão "salta" da tela: fica sobre o mesmo cartão da captura (≈30% do topo, 25% da altura) e sai
                um pouco para a esquerda, girado, com o saldo contando. Acompanha o celular no paralaxe.
              */}
              <m.div
                aria-hidden
                className="brand-ring absolute left-[7%] top-[30%] flex h-[25%] w-[86%] flex-col justify-between rounded-[22px] bg-brand p-4 text-brand-fg shadow-[0_24px_48px_-16px_rgba(20,23,15,0.45)] md:p-5"
                initial={enter({ opacity: 0, x: 0, rotate: 0, scale: 0.98 })}
                animate={{ opacity: 1, x: '-7%', rotate: -3, scale: 1.08 }}
                transition={{ duration: 0.7, delay: 0.35, ease: EASE_OUT }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold">Saldo em todas as contas</p>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-tangerine">
                    <Wallet className="h-4 w-4 text-brand-fg" strokeWidth={2} />
                  </span>
                </div>
                <CountingBalance cents={HERO_BALANCE_CENTS} />
              </m.div>
            </m.div>
          </m.div>
          <m.div aria-hidden style={{ y: chipsY }} className="pointer-events-none absolute inset-0">
            <FloatingChip icon={ShoppingCart} tint={PALETTE.sky} name="Mercado" amount="− R$ 164,30" kind="expense" className="-right-1 top-[9%] rotate-3 md:-right-8" delay={0.42} floatClass="site-float" />
            <FloatingChip icon={Briefcase} tint={PALETTE.grape} name="Salário" amount="+ R$ 5.070,00" kind="income" className="-left-1 top-[62%] -rotate-2 md:-left-14" delay={0.5} floatClass="site-float site-float-slow" />
            <FloatingChip icon={Utensils} tint={PALETTE.tangerine} name="Restaurante" amount="− R$ 70,00" kind="expense" className="-right-1 bottom-[3%] -rotate-1 md:-right-10" delay={0.56} floatClass="site-float site-float-late" />
          </m.div>
        </div>
      </div>
    </section>
  );
}
