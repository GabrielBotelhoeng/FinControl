import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { controlClass } from './field';

const MAX_DIGITS = 12;
const plain = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number | null;
  onChange: (cents: number | null) => void;
};

/** Máscara de caixa registradora: os dígitos entram pela direita; o valor emitido é sempre em centavos. */
export const MoneyInput = forwardRef<HTMLInputElement, Props>(function MoneyInput({ value, onChange, className, ...props }, ref) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">
        R$
      </span>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={cn(controlClass, 'tabular pl-10 font-display text-base font-semibold', className)}
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
