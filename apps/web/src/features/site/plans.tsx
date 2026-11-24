import { Check, Sparkles } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useState, type KeyboardEvent } from 'react';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/cn';
import { formatBRL, splitBRL } from '../../lib/format';
import { useSiteDemo } from './demo-context';
import { freeMonthsOnYearly, PLANS, PRICES_ARE_PROVISIONAL, yearlyPerMonthCents, type Billing, type Plan } from './pricing';
import { EASE_OUT, Reveal, RevealItem } from './reveal';
import { SectionHeading } from './section-heading';

// Os meses de graça do anual vêm do plano pago, para a chave nunca contradizer os preços de `pricing.ts`.
const YEARLY_FREE_MONTHS = Math.max(...PLANS.map(freeMonthsOnYearly));

const BILLING_OPTIONS: { value: Billing; label: string }[] = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'yearly', label: 'Anual' },
];

/** Chave Mensal/Anual: radiogroup com as setas do teclado e o indicador limão deslizando (só `transform`, em CSS). */
function BillingSwitch({ value, onChange }: { value: Billing; onChange: (b: Billing) => void }) {
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const next: Billing = value === 'monthly' ? 'yearly' : 'monthly';
    onChange(next);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${next}"]`)?.focus();
  }
  return (
    <div
      role="radiogroup"
      aria-label="Forma de pagamento"
      onKeyDown={onKeyDown}
      className="relative grid grid-cols-2 rounded-full border border-border bg-surface p-1 shadow-panel"
    >
      {/* As duas opções têm a mesma largura, então o indicador só desliza meia largura. */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-brand transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          value === 'yearly' && 'translate-x-full',
        )}
      />
      {BILLING_OPTIONS.map((o) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            data-value={o.value}
            onClick={() => onChange(o.value)}
            className={cn('relative h-10 whitespace-nowrap rounded-full px-5 text-sm font-semibold transition-colors', checked ? 'text-brand-fg' : 'text-muted hover:text-text')}
          >
            {o.label}
            {o.value === 'yearly' && YEARLY_FREE_MONTHS > 0 && <span className="ml-1.5 text-xs font-semibold opacity-75">{YEARLY_FREE_MONTHS} meses grátis</span>}
          </button>
        );
      })}
    </div>
  );
}

/** O preço com "R$" e centavos finos; ao trocar, o número novo sobe (mais caro) ou desce (mais barato). */
function Price({ cents, suffix }: { cents: number; suffix: string }) {
  const [previous, setPrevious] = useState(cents);
  const [direction, setDirection] = useState(1);
  if (previous !== cents) {
    setDirection(cents > previous ? 1 : -1);
    setPrevious(cents);
  }
  const parts = splitBRL(cents);
  return (
    <div className="flex items-end gap-2">
      <span className="relative inline-flex overflow-hidden py-1">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <m.span
            key={cents}
            custom={direction}
            className="tabular whitespace-nowrap font-display text-5xl leading-none tracking-[-0.03em] md:text-6xl"
            variants={{
              enter: (d: number) => ({ y: d * 28, opacity: 0 }),
              center: { y: 0, opacity: 1 },
              exit: (d: number) => ({ y: d * -28, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: EASE_OUT }}
          >
            <span className="font-extralight">{parts.currency} </span>
            <span className="font-extrabold">{parts.integer}</span>
            <span className="font-extralight">{parts.cents}</span>
          </m.span>
        </AnimatePresence>
      </span>
      <span className="pb-2 text-sm font-semibold opacity-70">{suffix}</span>
    </div>
  );
}

function PlanCard({ plan, billing }: { plan: Plan; billing: Billing }) {
  const demo = useSiteDemo();
  const free = plan.monthlyCents === 0;
  const cents = free ? 0 : billing === 'monthly' ? plan.monthlyCents : plan.yearlyCents;
  const suffix = free ? 'para sempre' : billing === 'monthly' ? 'por mês' : 'por ano';
  const note = free
    ? ''
    : billing === 'yearly'
      ? `Sai por ${formatBRL(yearlyPerMonthCents(plan))} por mês, com ${freeMonthsOnYearly(plan)} meses de graça.`
      : `Ou ${formatBRL(plan.yearlyCents)} por ano.`;
  return (
    <article
      aria-labelledby={`plano-${plan.id}`}
      className={cn(
        'relative flex h-full flex-col rounded-[var(--radius-card)] p-7 md:p-9',
        plan.highlight ? 'brand-ring bg-brand text-brand-fg shadow-bar' : 'border border-border bg-surface text-text shadow-panel',
      )}
    >
      <h3 id={`plano-${plan.id}`} className="font-display text-2xl font-bold tracking-[-0.02em]">
        {plan.name}
      </h3>
      <p className={cn('mt-1 text-sm', plan.highlight ? 'opacity-80' : 'text-muted')}>{plan.tagline}</p>
      <div className="mt-6" data-testid={`preco-${plan.id}`}>
        <Price cents={cents} suffix={suffix} />
        <p className={cn('mt-1 min-h-5 text-sm', plan.highlight ? 'opacity-80' : 'text-muted')}>{note}</p>
      </div>
      <ul className="mt-7 grid gap-3">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm font-medium">
            <Check aria-hidden className={cn('mt-0.5 h-4 w-4 shrink-0', plan.highlight ? 'text-brand-fg' : 'text-primary')} strokeWidth={2.25} />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-9">
        <Button
          size="lg"
          onClick={() => void demo.start()}
          loading={demo.pending}
          variant={plan.highlight ? 'dark' : 'primary'}
          className="w-full"
        >
          {!demo.pending && <Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
          {free ? 'Experimentar sem cadastro' : 'Experimentar o Completo'}
        </Button>
      </div>
    </article>
  );
}

/** Planos (seção 3.8): preços provisórios de `pricing.ts`, com o selo e o aviso de que hoje tudo está liberado. */
export function Pricing() {
  const [billing, setBilling] = useState<Billing>('monthly');
  return (
    <section id="planos" aria-labelledby="planos-titulo" className="px-4 py-20 md:px-10 md:py-28">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col items-center text-center">
          <SectionHeading
            id="planos-titulo"
            eyebrow="Planos"
            className="mx-auto"
            title={
              <>
                <span className="font-extralight">Barato de verdade,</span> <span className="font-extrabold">grátis para começar.</span>
              </>
            }
          />
          {PRICES_ARE_PROVISIONAL && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <span className="rounded-full bg-banana-soft px-3.5 py-1.5 text-xs font-semibold text-text ring-1 ring-banana/60">
                Preços de lançamento, provisórios
              </span>
              <p className="text-sm text-muted">Hoje todos os recursos estão liberados de graça.</p>
            </div>
          )}
          <div className="mt-8">
            <BillingSwitch value={billing} onChange={setBilling} />
          </div>
        </div>
        <Reveal stagger={0.09} className="mt-12 grid gap-5 md:grid-cols-2 md:gap-6">
          {PLANS.map((plan) => (
            <RevealItem key={plan.id} className="h-full">
              <PlanCard plan={plan} billing={billing} />
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
