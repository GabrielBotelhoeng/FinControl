import { ASSET_KIND_LABELS, type AssetDTO, type NetWorthDTO } from '@fincontrol/shared';
import { CheckCircle2, Gem, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { HeroAmount } from '../../components/ui/money';
import { PageHeader } from '../../components/ui/page-header';
import { Panel } from '../../components/ui/panel';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/states';
import { formatBRL, formatDate, formatMonthShort } from '../../lib/format';
import { useNetWorth } from './api';
import { AssetDialog } from './asset-dialog';
import { AssetForm } from './asset-form';
import { ASSET_KIND_ICON } from './asset-kind';
import { NetWorthChart } from './net-worth-chart';

const signed = (cents: number) => `${cents > 0 ? '+' : '−'}${formatBRL(Math.abs(cents))}`;

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={strong ? 'font-medium' : 'min-w-0 truncate text-muted'}>{label}</span>
      <span className={`tabular shrink-0 ${strong ? 'font-semibold' : ''}`}>{formatBRL(value)}</span>
    </div>
  );
}

/** B11: o que tem (cada conta e os bens) e o que deve (por tipo de dívida). */
function Composition({ data }: { data: NetWorthDTO }) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
      <Panel role="region" aria-label="O que você tem" className="grid content-start gap-3 p-5 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">O que você tem</h2>
          <span className="tabular font-display text-lg font-semibold">{formatBRL(data.accounts.total + data.assets.total)}</span>
        </div>
        <Row label="Contas" value={data.accounts.total} strong />
        {(data.accounts.items.length > 0 || data.accounts.cardCredit > 0) && (
          <div className="grid gap-1.5 border-l border-border pl-3">
            {data.accounts.items.map((a) => (
              <Row key={a.accountId} label={a.name} value={a.balance} />
            ))}
            {/* Revisão: o que foi pago a mais no cartão é dinheiro da pessoa. */}
            {data.accounts.cardCredit > 0 && <Row label="Crédito nos cartões" value={data.accounts.cardCredit} />}
          </div>
        )}
        <Row label="Bens" value={data.assets.total} strong />
        <Link to="/contas" className="justify-self-start font-medium text-primary hover:underline">
          Ver contas
        </Link>
      </Panel>
      <Panel role="region" aria-label="O que você deve" className="grid content-start gap-3 p-5 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">O que você deve</h2>
          <span className="tabular font-display text-lg font-semibold">{formatBRL(data.debts.total)}</span>
        </div>
        {data.debts.total === 0 ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-income">
            <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
            Nenhuma dívida em cartões, empréstimos ou com credores
          </span>
        ) : (
          <>
            <Row label="Cartões" value={data.debts.cards} />
            <Row label="Empréstimos" value={data.debts.loans} />
            <Row label="Credores" value={data.debts.others} />
          </>
        )}
        <Link to="/dividas" className="justify-self-start font-medium text-primary hover:underline">
          Ver dívidas
        </Link>
      </Panel>
    </div>
  );
}

function AssetItem({ asset, onOpen }: { asset: AssetDTO; onOpen: () => void }) {
  const Icon = ASSET_KIND_ICON[asset.kind];
  const change = asset.value - asset.firstValue;
  return (
    <Panel role="article" aria-label={asset.name} className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-muted">
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            {/* Quebra em vez de cortar: a 360 px, "Previdência privada" virava "Previdênci…". */}
            <p className="break-words font-display text-lg font-semibold leading-snug tracking-tight">{asset.name}</p>
            <p className="truncate text-sm text-muted">{ASSET_KIND_LABELS[asset.kind]}</p>
          </div>
        </div>
        <span className="tabular shrink-0 font-display text-lg font-semibold">{formatBRL(asset.value)}</span>
      </div>
      <p className="text-sm text-muted">
        {asset.value === 0 ? 'Vendido ou sem valor hoje' : `Atualizado em ${formatDate(asset.updatedOn)}`}
        {asset.value > 0 && change !== 0 && ` · ${signed(change)} desde ${formatDate(asset.since)}`}
      </p>
      <button type="button" onClick={onOpen} className="self-start text-sm font-medium text-primary hover:underline">
        Ver histórico e atualizar
      </button>
    </Panel>
  );
}

export default function NetWorthPage() {
  const netWorth = useNetWorth();
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<AssetDTO | null>(null);

  const newButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
      Novo bem
    </Button>
  );
  const data = netWorth.data;
  const first = data?.series[0];
  const change = data && first ? data.total - first.total : 0;

  return (
    <>
      <PageHeader
        light="Seu"
        bold="patrimônio"
        description="Tudo o que você tem (contas e bens) menos tudo o que você deve (cartões, empréstimos e credores), e como isso mudou em 12 meses."
        actions={newButton}
      />

      {netWorth.isPending && (
        <div className="grid gap-4">
          <Skeleton className="h-20 w-full max-w-lg" />
          <Skeleton className="h-48 rounded-[var(--radius-panel)]" />
        </div>
      )}
      {netWorth.isError && <ErrorState message={netWorth.error.message} onRetry={() => netWorth.refetch()} />}
      {data && (
        <>
          <section className="aurora mb-10 grid gap-3">
            <p className="text-sm text-muted">Patrimônio líquido hoje</p>
            <p aria-label="Patrimônio líquido hoje">
              <HeroAmount cents={data.total} className="block text-[clamp(2.75rem,8vw,4.25rem)]" />
            </p>
            {first && change !== 0 && (
              <p className="text-sm text-muted">
                <span className={`tabular font-semibold ${change > 0 ? 'text-income' : 'text-expense'}`}>{signed(change)}</span>
                {` desde o fim de ${formatMonthShort(first.month)}`}
              </p>
            )}
          </section>

          <Composition data={data} />

          <Panel className="mb-6 p-5 sm:p-6">
            <h2 className="mb-4 font-display text-lg font-semibold tracking-tight">Últimos 12 meses</h2>
            <NetWorthChart data={data.series} />
          </Panel>

          <section aria-label="Seus bens" className="grid gap-4">
            <h2 className="font-display text-lg font-semibold tracking-tight">Seus bens</h2>
            {data.assets.items.length === 0 ? (
              <EmptyState
                icon={<Gem className="h-7 w-7" strokeWidth={1.5} />}
                title="Nenhum bem cadastrado"
                description="Cadastre o que você tem fora das contas: imóvel, carro, previdência, ações ou dinheiro que alguém deve a você."
                action={newButton}
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {data.assets.items.map((a) => (
                  <AssetItem key={a.id} asset={a} onOpen={() => setOpen(a)} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {creating && <AssetForm onOpenChange={setCreating} />}
      {open && <AssetDialog assetId={open.id} title={open.name} onOpenChange={(o) => !o && setOpen(null)} />}
    </>
  );
}
