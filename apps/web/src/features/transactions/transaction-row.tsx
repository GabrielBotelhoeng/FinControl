import { categoryPath, type AccountDTO, type CategoryDTO, type TransactionDTO } from '@fincontrol/shared';
import { ArrowLeftRight, Check, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { SignedAmount } from '../../components/ui/money';
import { cn } from '../../lib/cn';
import { IconTile } from '../../components/ui/icon-tile';
import { PALETTE } from '../../lib/palette';
import { iconFor } from '../categories/icons';
import { usePayToggle } from './api';

type Props = {
  tx: TransactionDTO;
  account?: AccountDTO | undefined;
  category?: CategoryDTO | undefined;
  /** A categoria principal, quando o lançamento está numa subcategoria (sub-projeto 15, U4). */
  parent?: CategoryDTO | undefined;
  destination?: AccountDTO | undefined;
  onEdit: () => void;
};

export function TransactionRow({ tx, account, category, parent, destination, onEdit }: Props) {
  const pay = usePayToggle();
  const paid = tx.status === 'paid';
  // Lançamento de cartão (decisão R19): sempre pago (spec C4) — a API recusa pagar/desfazer (422) — e por
  // isso não mostra o botão. A conta de origem é que define isso (mesmo critério de assertNotCardTransaction).
  const isCardTransaction = account?.type === 'credit_card';
  const Icon = tx.type === 'transfer' ? ArrowLeftRight : iconFor(category?.icon ?? '');
  const tint = tx.type === 'transfer' ? PALETTE.sky : (category?.color ?? PALETTE.slate);
  const categoryName = category ? categoryPath(category.name, parent?.name) : undefined;
  const base = tx.type === 'transfer' ? `${account?.name ?? 'Conta'} → ${destination?.name ?? 'Conta'}` : [categoryName, account?.name].filter(Boolean).join(' · ');
  // Sub-projeto 13 (T8): as tags na mesma linha, que corta com "…" quando não cabe. Durante o deploy, a API antiga
  // ainda não manda o campo.
  const meta = [base, (tx.tags ?? []).map((t) => `#${t}`).join(' ')].filter(Boolean).join(' · ');

  return (
    <li aria-label={tx.description} className="group flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
      <IconTile icon={Icon} color={tint} />
      <button type="button" onClick={onEdit} aria-label={`Editar ${tx.description}`} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{tx.description}</span>
          {tx.installmentNumber != null && tx.installmentTotal != null && (
            <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">
              {tx.installmentNumber}/{tx.installmentTotal}
            </span>
          )}
          {tx.recurrenceId && <Repeat aria-label="Recorrente" className="h-3.5 w-3.5 shrink-0 text-muted" strokeWidth={1.75} />}
          {tx.overdue && <span className="shrink-0 rounded-full bg-expense-soft px-2 py-0.5 text-[11px] font-semibold text-expense">Vencido</span>}
        </span>
        <span className="block truncate text-xs text-muted">{meta}</span>
      </button>
      <SignedAmount cents={tx.amount} type={tx.type} className={cn('text-sm sm:text-base', !paid && 'opacity-70')} />
      {!isCardTransaction && (
        <button
          type="button"
          aria-label={paid ? `Desfazer pagamento de ${tx.description}` : `Marcar ${tx.description} como pago`}
          aria-pressed={paid}
          disabled={pay.isPending}
          onClick={() => pay.mutate({ id: tx.id, paid: !paid }, { onError: (e) => toast.error(e.message) })}
          className={cn(
            'grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors',
            paid ? 'border-transparent bg-brand text-brand-fg' : 'border-border text-muted hover:border-primary hover:text-primary',
          )}
        >
          <Check aria-hidden className="h-4 w-4" strokeWidth={2.25} />
        </button>
      )}
    </li>
  );
}
