import { LOAN_KIND_LABELS, type LoanDetailDTO, type LoanWarning } from '@fincontrol/shared';
import { AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Field, Input } from '../../components/ui/field';
import { PageHeader } from '../../components/ui/page-header';
import { Panel } from '../../components/ui/panel';
import { ErrorState, ListSkeleton } from '../../components/ui/states';
import { ApiError } from '../../lib/api-client';
import { formatBRL, formatRate } from '../../lib/format';
import { useDeleteLoan, useLoan, useRenameLoan } from './api';
import { RateComparison } from './rate-comparison';

const WARNING_TEXT: Record<LoanWarning, string> = {
  informed_rate_differs: 'A taxa informada difere da calculada. Pode haver seguro ou tarifa embutida.',
  rate_too_high: 'Taxa acima de 30% ao mês. Confira os valores digitados.',
  sac_approximate: 'Financiamentos imobiliários costumam usar SAC; esta taxa é aproximada.',
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted">{label}</span>
      <span className="tabular font-display text-lg font-semibold">{value}</span>
    </div>
  );
}

function RenameDialog({ loan, onOpenChange }: { loan: LoanDetailDTO; onOpenChange: (o: boolean) => void }) {
  const rename = useRenameLoan();
  const [name, setName] = useState(loan.name);
  const [error, setError] = useState<string | undefined>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Dê um nome para o empréstimo.');
    try {
      await rename.mutateAsync({ id: loan.id, name: name.trim() });
      toast.success('Empréstimo renomeado.');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível renomear.');
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange} title="Renomear empréstimo">
      <form onSubmit={submit} className="grid gap-5" noValidate>
        <Field label="Nome" error={error}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={rename.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function DeleteDialog({ loan, onOpenChange }: { loan: LoanDetailDTO; onOpenChange: (o: boolean) => void }) {
  const remove = useDeleteLoan();
  const navigate = useNavigate();

  async function confirm() {
    try {
      await remove.mutateAsync(loan.id);
      toast.success('Empréstimo excluído.');
      navigate('/emprestimos');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir.');
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange} title="Excluir empréstimo?">
      <p className="text-sm text-muted">As parcelas pendentes serão apagadas. As já pagas continuam no histórico.</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button className="bg-expense text-white" loading={remove.isPending} onClick={confirm}>
          Excluir
        </Button>
      </div>
    </Dialog>
  );
}

/**
 * Uma instância por empréstimo (`key` = id da rota): trocar de empréstimo pelo histórico do navegador com um
 * diálogo aberto não pode levar o "Excluir" para o outro empréstimo (revisão do CodeRabbit).
 */
export default function LoanDetailPage() {
  const { id = '' } = useParams();
  return <LoanDetail key={id} id={id} />;
}

function LoanDetail({ id }: { id: string }) {
  const loan = useLoan(id);
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null);
  const l = loan.data;

  return (
    <>
      <PageHeader
        light=""
        bold={l?.name ?? 'Empréstimo'}
        {...(l ? { description: `${LOAN_KIND_LABELS[l.kind]} · ${l.bankName}` } : {})}
        actions={
          l && (
            <>
              <Button variant="secondary" onClick={() => setDialog('rename')}>
                <Pencil aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Renomear
              </Button>
              <Button variant="ghost" className="text-expense" onClick={() => setDialog('delete')}>
                <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Excluir empréstimo
              </Button>
            </>
          )
        }
      />

      {loan.isPending && <ListSkeleton />}
      {loan.isError && <ErrorState message={loan.error.message} onRetry={() => loan.refetch()} />}

      {l && (
        <div className="grid gap-6">
          <div className="aurora grid gap-2">
            <p className="font-display text-2xl font-semibold tracking-tight">{`Taxa real ${formatRate(l.monthlyRate)} ao mês · ${formatRate(l.annualRate)} ao ano`}</p>
            <p className="text-sm text-muted">
              {`Você pegou ${formatBRL(l.principal)} e vai devolver ${formatBRL(l.totalCost)}; ${formatBRL(l.interest)} são juros.`}
            </p>
          </div>

          {l.warnings.length > 0 && (
            <ul className="grid gap-2">
              {l.warnings.map((w) => (
                <li key={w} className="inline-flex items-start gap-2 text-sm font-medium text-warning">
                  <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                  {WARNING_TEXT[w]}
                </li>
              ))}
            </ul>
          )}

          <Panel role="group" aria-label="Situação do empréstimo" className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-4">
            <Stat label="Parcelas" value={`${l.installmentsPaid} de ${l.installmentsTotal} parcelas`} />
            <Stat label="Pago" value={formatBRL(l.paidAmount)} />
            <Stat label="Falta pagar" value={formatBRL(l.installmentAmount * l.remainingCount)} />
            <Stat label="Saldo devedor" value={formatBRL(l.outstanding)} />
          </Panel>

          <div className="grid gap-6 md:grid-cols-2">
            <Panel role="region" aria-label="Quitação antecipada" className="grid gap-2 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-semibold tracking-tight">Quitação antecipada</h2>
                <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted">Estimativa</span>
              </div>
              <p className="tabular font-display text-2xl font-bold">{formatBRL(l.outstanding)}</p>
              <p className="text-sm text-muted">{`Quitando hoje, você teria uma economia de ${formatBRL(l.payoffSavings)} em juros.`}</p>
              <p className="text-xs text-muted">
                O banco precisa descontar os juros das parcelas que você antecipa (CDC art. 52 §2º). O valor exato vem no boleto de quitação.
              </p>
            </Panel>
            <RateComparison monthlyRate={l.monthlyRate} comparison={l.comparison} />
          </div>
        </div>
      )}

      {l && dialog === 'rename' && <RenameDialog loan={l} onOpenChange={(o) => !o && setDialog(null)} />}
      {l && dialog === 'delete' && <DeleteDialog loan={l} onOpenChange={(o) => !o && setDialog(null)} />}
    </>
  );
}
