import type { LoanDTO } from '@fincontrol/shared';
import { ChevronRight, Landmark, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { PageHeader } from '../../components/ui/page-header';
import { Panel } from '../../components/ui/panel';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/states';
import { formatBRL, formatRate } from '../../lib/format';
import { useLoans } from './api';
import { LoanForm } from './loan-form';

function LoanItem({ loan }: { loan: LoanDTO }) {
  const pct = Math.round((loan.installmentsPaid / loan.installmentsTotal) * 100);
  return (
    <Panel role="article" aria-label={loan.name} className="flex flex-col gap-4 p-6">
      <div className="min-w-0">
        <p className="truncate font-display text-lg font-semibold tracking-tight">{loan.name}</p>
        <p className="truncate text-sm text-muted">{loan.bankName}</p>
      </div>
      <div className="grid gap-2">
        <div className="flex justify-between text-sm">
          <span>{`${loan.installmentsPaid} de ${loan.installmentsTotal} pagas`}</span>
          <span className="tabular text-muted">{pct}%</span>
        </div>
        <div
          role="progressbar"
          aria-label={`Parcelas pagas de ${loan.name}`}
          aria-valuemin={0}
          aria-valuemax={loan.installmentsTotal}
          aria-valuenow={loan.installmentsPaid}
          className="h-2 overflow-hidden rounded-full bg-surface-2"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
        <span>
          Taxa real <span className="tabular font-semibold text-text">{`${formatRate(loan.monthlyRate)} ao mês`}</span>
        </span>
        <span>
          Saldo devedor <span className="tabular font-semibold text-text">{formatBRL(loan.outstanding)}</span>
        </span>
      </div>
      <Link to={`/emprestimos/${loan.id}`} className="inline-flex items-center gap-1 self-start text-sm font-medium text-primary hover:underline">
        Ver detalhes
        <ChevronRight aria-hidden className="h-4 w-4" />
      </Link>
    </Panel>
  );
}

export default function LoansPage() {
  const loans = useLoans();
  const [creating, setCreating] = useState(false);

  const newButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
      Cadastrar empréstimo
    </Button>
  );

  return (
    <>
      <PageHeader
        light="Seus"
        bold="empréstimos"
        description="Cadastre com o que você sabe (valor recebido, parcela e prazo) e veja a taxa de juros real."
        actions={newButton}
      />

      {loans.isPending && (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-48 rounded-[var(--radius-panel)]" />
          ))}
        </div>
      )}
      {loans.isError && <ErrorState message={loans.error.message} onRetry={() => loans.refetch()} />}
      {loans.data && loans.data.length === 0 && (
        <EmptyState
          icon={<Landmark className="h-7 w-7" strokeWidth={1.5} />}
          title="Nenhum empréstimo ainda"
          description="Empréstimos e financiamentos aparecem aqui, com a taxa real, o saldo devedor e a comparação com o mercado."
          action={newButton}
        />
      )}
      {loans.data && loans.data.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {loans.data.map((l) => (
            <LoanItem key={l.id} loan={l} />
          ))}
        </div>
      )}

      {creating && <LoanForm open onOpenChange={setCreating} />}
    </>
  );
}
