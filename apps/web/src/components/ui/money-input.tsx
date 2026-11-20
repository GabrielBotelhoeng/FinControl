import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { controlClass } from './field';

const MAX_DIGITS = 12;
// Sem as classes de tamanho do controlClass: sem tailwind-merge, duas alturas ou dois tamanhos de letra brigariam.
const LARGE_CLASS =
  'h-16 w-full rounded-[16px] border border-border bg-surface-2 pl-14 pr-3.5 text-3xl font-bold tracking-tight text-text placeholder:text-muted ' +
  'transition-colors focus:border-primary focus:outline-none aria-[invalid=true]:border-expense';
const plain = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'size'> & {
  value: number | null;
  onChange: (cents: number | null) => void;
  /** `lg`: o valor em destaque, como no formulário de lançamento (sub-projeto 16, L8). */
  size?: 'md' | 'lg';
};

/** Máscara de caixa registradora: os dígitos entram pela direita; o valor emitido é sempre em centavos. */
export const MoneyInput = forwardRef<HTMLInputElement, Props>(function MoneyInput({ value, onChange, className, size = 'md', ...props }, ref) {
  const large = size === 'lg';
  return (
    <div className="relative">
      <span aria-hidden className={cn('pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted', large ? 'left-4 font-display text-xl font-light' : 'left-3.5 text-sm')}>
        R$
      </span>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={cn(large ? LARGE_CLASS : cn(controlClass, 'pl-10 text-base font-semibold'), 'tabular font-display', className)}
        value={value === null ? '' : plain.format(value / 100)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DIGITS);
          onChange(digits ? Number(digits) : null);
        }}
        {...props}
      />
    </div>
  );
});
