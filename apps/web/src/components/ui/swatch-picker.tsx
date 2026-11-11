import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';
import { SWATCHES } from '../../lib/swatches';

export function SwatchPicker({ value, onChange, label = 'Cor' }: { value: string; onChange: (c: string) => void; label?: string }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2.5">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value.toLowerCase() === c.toLowerCase()}
            aria-label={`Cor ${c}`}
            onClick={() => onChange(c)}
            className={cn('grid h-9 w-9 place-items-center rounded-full ring-offset-2 ring-offset-surface transition', value.toLowerCase() === c.toLowerCase() && 'ring-2 ring-text')}
            style={{ backgroundColor: c }}
          >
            {value.toLowerCase() === c.toLowerCase() && <Check aria-hidden className="h-4 w-4 text-white" strokeWidth={2.5} />}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
