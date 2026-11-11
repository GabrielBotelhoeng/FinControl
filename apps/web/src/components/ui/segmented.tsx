import { cn } from '../../lib/cn';

type Option<T extends string> = { value: T; label: string };

/** Grupo de opções em pílula (radiogroup acessível). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-full border border-border bg-surface-2 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-9 rounded-full px-4 text-sm font-medium transition-colors',
            o.value === value ? 'bg-surface text-text shadow-panel' : 'text-muted hover:text-text',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
