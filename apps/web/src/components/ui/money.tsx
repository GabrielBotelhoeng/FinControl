import type { TransactionType } from '@fincontrol/shared';
import { cn } from '../../lib/cn';
import { formatSignedBRL, splitBRL } from '../../lib/format';

/** Valor com sinal e cor por tipo: verde só para receita, vermelho só para despesa. */
export function SignedAmount({ cents, type, className }: { cents: number; type: TransactionType; className?: string }) {
  const color = type === 'income' ? 'text-income' : type === 'expense' ? 'text-expense' : 'text-text';
  return <span className={cn('tabular font-semibold', color, className)}>{formatSignedBRL(cents, type)}</span>;
}

/** O saldo herói: "R$" e centavos em peso fino, inteiros em extra-negrito (âncora do DESIGN.md). */
export function HeroAmount({ cents, className }: { cents: number; className?: string }) {
  const parts = splitBRL(cents);
  return (
    <span className={cn('tabular font-display leading-none tracking-[-0.02em]', className)}>
      <span className="font-extralight">
        {parts.sign}
        {parts.currency}{' '}
      </span>
      <span className="font-extrabold">{parts.integer}</span>
      <span className="font-extralight">{parts.cents}</span>
    </span>
  );
}
