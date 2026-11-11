import { addMonthsToYm, type YearMonth } from '@fincontrol/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonthLabel } from '../../lib/format';
import { Button } from './button';

export function MonthPicker({ value, onChange }: { value: YearMonth; onChange: (ym: YearMonth) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1">
      <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Mês anterior" onClick={() => onChange(addMonthsToYm(value, -1))}>
        <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      </Button>
      <span aria-live="polite" className="min-w-[10.5rem] text-center text-sm font-semibold capitalize">
        {formatMonthLabel(value)}
      </span>
      <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Próximo mês" onClick={() => onChange(addMonthsToYm(value, 1))}>
        <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      </Button>
    </div>
  );
}
