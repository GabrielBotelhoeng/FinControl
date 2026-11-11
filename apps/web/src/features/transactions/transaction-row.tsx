import type { AccountDTO, CategoryDTO, TransactionDTO } from '@fincontrol/shared';
import { ArrowLeftRight, Check, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { SignedAmount } from '../../components/ui/money';
import { cn } from '../../lib/cn';
import { iconFor } from '../categories/icons';
import { usePayToggle } from './api';

type Props = {
  tx: TransactionDTO;
  account?: AccountDTO | undefined;
  category?: CategoryDTO | undefined;
  destination?: AccountDTO | undefined;
  onEdit: () => void;
};

export function TransactionRow({ tx, account, category, destination, onEdit }: Props) {
  const pay = usePayToggle();
  const paid = tx.status === 'paid';
  const Icon = tx.type === 'transfer' ? ArrowLeftRight : iconFor(category?.icon ?? '');
  const tint = tx.type === 'transfer' ? 'var(--primary)' : (category?.color ?? 'var(--text-muted)');
  const meta = tx.type === 'transfer' ? `${account?.name ?? 'Conta'} → ${destination?.name ?? 'Conta'}` : [category?.name, account?.name].filter(Boolean).join(' · ');

  return (
    <li aria-label={tx.description} className="group flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${tint} 16%, transparent)`, color: tint }}>
        <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>
      <button type="button" onClick={onEdit} aria-label={`Editar ${tx.description}`} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{tx.description}</span>
          {tx.recurrenceId && <Repeat aria-label="Recorrente" className="h-3.5 w-3.5 shrink-0 text-muted" strokeWidth={1.75} />}
          {tx.overdue && <span className="shrink-0 rounded-full bg-expense-soft px-2 py-0.5 text-[11px] font-semibold text-expense">Vencido</span>}
        </span>
        <span className="block truncate text-xs text-muted">{meta}</span>
      </button>
      <SignedAmount cents={tx.amount} type={tx.type} className={cn('text-sm sm:text-base', !paid && 'opacity-70')} />
      <button
        type="button"
        aria-label={paid ? `Desfazer pagamento de ${tx.description}` : `Marcar ${tx.description} como pago`}
        aria-pressed={paid}
        disabled={pay.isPending}
        onClick={() => pay.mutate({ id: tx.id, paid: !paid }, { onError: (e) => toast.error(e.message) })}
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors',
          paid ? 'border-transparent bg-primary text-primary-fg' : 'border-border text-muted hover:border-primary hover:text-primary',
        )}
      >
        <Check aria-hidden className="h-4 w-4" strokeWidth={2.25} />
      </button>
    </li>
  );
}
