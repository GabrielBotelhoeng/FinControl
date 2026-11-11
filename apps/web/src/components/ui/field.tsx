import { cloneElement, forwardRef, isValidElement, useId, type InputHTMLAttributes, type ReactElement, type SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export const controlClass =
  'h-11 w-full rounded-[var(--radius-control)] border border-border bg-surface-2 px-3.5 text-sm text-text placeholder:text-muted ' +
  'transition-colors focus:border-primary focus:outline-none aria-[invalid=true]:border-expense';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(controlClass, className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={cn(controlClass, 'appearance-none pr-9', className)} {...props} />;
});

type FieldProps = { label: string; error?: string | undefined; hint?: string; children: ReactElement<Record<string, unknown>>; className?: string };

/** Rótulo acima, ajuda opcional e erro abaixo; liga id, aria-describedby e aria-invalid ao controle. */
export function Field({ label, error, hint, children, className }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })
    : children;
  return (
    <div className={cn('grid gap-2', className)}>
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-expense">
          {error}
        </p>
      )}
    </div>
  );
}
