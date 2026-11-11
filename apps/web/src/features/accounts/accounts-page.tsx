import type { AccountDTO } from '@fincontrol/shared';
import { Archive, ArchiveRestore, ArrowLeftRight, Landmark, PiggyBank, Pencil, Plus, TrendingUp, Wallet } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { HeroAmount } from '../../components/ui/money';
import { PageHeader } from '../../components/ui/page-header';
import { Panel } from '../../components/ui/panel';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/states';
import { cn } from '../../lib/cn';
import { AccountForm } from './account-form';
import { accountTypeLabel, useAccounts, useArchiveAccount } from './api';
import { TransferForm } from './transfer-form';

const TYPE_ICON = { checking: Landmark, savings: PiggyBank, wallet: Wallet, investment: TrendingUp } as const;

function AccountItem({ account, onEdit }: { account: AccountDTO; onEdit: () => void }) {
  const archive = useArchiveAccount();
  const Icon = TYPE_ICON[account.type];
  const archived = account.archivedAt !== null;
  return (
    <Panel aria-label={account.name} role="article" className={cn('flex flex-col gap-6 p-6', archived && 'opacity-60')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full" style={{ backgroundColor: `${account.color}22`, color: account.color }}>
            <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="font-semibold">{account.name}</h2>
            <p className="text-xs text-muted">
              {accountTypeLabel(account.type)}
              {archived && ' · arquivada'}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" aria-label={`Editar ${account.name}`} onClick={onEdit}>
            <Pencil aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${archived ? 'Desarquivar' : 'Arquivar'} ${account.name}`}
            onClick={() =>
              archive.mutate(
                { id: account.id, archive: !archived },
                { onSuccess: () => toast.success(archived ? 'Conta reativada.' : 'Conta arquivada.'), onError: (e) => toast.error(e.message) },
              )
            }
          >
            {archived ? <ArchiveRestore aria-hidden className="h-4 w-4" strokeWidth={1.75} /> : <Archive aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
          </Button>
        </div>
      </div>
      <HeroAmount cents={account.balance} className={cn('text-3xl', account.balance < 0 && 'text-expense')} />
    </Panel>
  );
}

export default function AccountsPage() {
  const [showArchived, setShowArchived] = useState(false);
  const accounts = useAccounts(showArchived);
  const [editing, setEditing] = useState<AccountDTO | 'new' | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const active = (accounts.data ?? []).filter((a) => a.archivedAt === null);
  const total = active.reduce((sum, a) => sum + a.balance, 0);

  const newButton = (
    <Button onClick={() => setEditing('new')}>
      <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
      Nova conta
    </Button>
  );

  return (
    <>
      <PageHeader
        light="Suas"
        bold="contas"
        description="Cada conta guarda o próprio saldo. A soma das ativas é o seu saldo total."
        actions={
          <>
            {active.length >= 2 && (
              <Button variant="secondary" onClick={() => setTransferOpen(true)}>
                <ArrowLeftRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Transferir
              </Button>
            )}
            {newButton}
          </>
        }
      />

      {accounts.isPending && (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-[var(--radius-panel)]" />
          ))}
        </div>
      )}
      {accounts.isError && <ErrorState message={accounts.error.message} onRetry={() => accounts.refetch()} />}
      {accounts.data && accounts.data.length === 0 && (
        <EmptyState
          icon={<Wallet className="h-7 w-7" strokeWidth={1.5} />}
          title="Nenhuma conta ainda"
          description="Cadastre onde seu dinheiro fica: conta corrente, poupança, carteira. Depois é só lançar receitas e despesas."
          action={newButton}
        />
      )}
      {accounts.data && accounts.data.length > 0 && (
        <>
          <div className="aurora mb-8">
            <p className="text-sm text-muted">Saldo das contas ativas</p>
            <HeroAmount cents={total} className="mt-2 block text-[clamp(2.5rem,6vw,4rem)]" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {accounts.data.map((a) => (
              <AccountItem key={a.id} account={a} onEdit={() => setEditing(a)} />
            ))}
          </div>
          <label className="mt-6 inline-flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Mostrar arquivadas
          </label>
        </>
      )}

      {editing && <AccountForm open onOpenChange={(o) => !o && setEditing(null)} {...(editing === 'new' ? {} : { account: editing })} />}
      {transferOpen && <TransferForm open onOpenChange={setTransferOpen} accounts={active} />}
    </>
  );
}
