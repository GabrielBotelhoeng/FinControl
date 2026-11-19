import { ASSET_KIND_LABELS, todayInSaoPaulo } from '@fincontrol/shared';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Field, Input } from '../../components/ui/field';
import { MoneyInput } from '../../components/ui/money-input';
import { ErrorState, ListSkeleton } from '../../components/ui/states';
import { ApiError } from '../../lib/api-client';
import { formatBRL, formatDate } from '../../lib/format';
import { useAddValuation, useAsset, useDeleteAsset, useDeleteValuation } from './api';
import { AssetForm } from './asset-form';

/** Detalhe do bem: atualizar o valor e o histórico (B6), editar e excluir (B7). */
export function AssetDialog({ assetId, title, onOpenChange }: { assetId: string; title: string; onOpenChange: (open: boolean) => void }) {
  const asset = useAsset(assetId);
  const add = useAddValuation();
  const removeValuation = useDeleteValuation();
  const removeAsset = useDeleteAsset();
  const today = todayInSaoPaulo();
  const [amount, setAmount] = useState<number | null>(null);
  const [sold, setSold] = useState(false);
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);

  async function save() {
    if (!sold && !amount) return setError('Informe o novo valor.');
    if (!date || date > today) return setError('A data não pode estar no futuro.');
    setError(null);
    try {
      // O campo de valor não aceita zero: a venda (ou a perda) vai pela caixa de seleção.
      await add.mutateAsync({ id: assetId, amount: sold ? 0 : amount!, date });
      toast.success(sold ? 'Venda registrada.' : 'Valor atualizado.');
      setAmount(null);
      setSold(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    }
  }

  async function deleteValuation(valuationId: string) {
    setError(null);
    try {
      await removeValuation.mutateAsync({ id: assetId, valuationId });
      toast.success('Valor excluído.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível excluir.');
    }
  }

  async function deleteAsset() {
    // Fecha antes: com o diálogo aberto, a invalidação pediria de novo o bem apagado e mostraria "Bem não encontrado".
    onOpenChange(false);
    try {
      await removeAsset.mutateAsync(assetId);
      toast.success('Bem excluído.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir.');
    }
  }

  if (editing && asset.data) return <AssetForm asset={asset.data} onOpenChange={(o) => !o && setEditing(false)} />;

  const valuations = asset.data?.valuations ?? [];
  return (
    <Dialog open onOpenChange={onOpenChange} title={title}>
      {asset.isPending && <ListSkeleton rows={3} />}
      {asset.isError && <ErrorState message={asset.error.message} onRetry={() => asset.refetch()} />}
      {asset.data && (
        <div className="grid gap-6">
          <p className="text-sm text-muted">
            {`${formatBRL(asset.data.value)} hoje · ${ASSET_KIND_LABELS[asset.data.kind]} · desde ${formatDate(asset.data.since)}`}
          </p>

          <div className="grid gap-4 rounded-[var(--radius-control)] border border-border p-4">
            <h3 className="font-semibold">Atualizar valor</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Novo valor">
                <MoneyInput value={sold ? 0 : amount} onChange={setAmount} disabled={sold} />
              </Field>
              <Field label="Data do valor">
                <Input type="date" value={date} min="1900-01-01" max={today} onChange={(e) => setDate(e.target.value)} />
              </Field>
            </div>
            <label className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" checked={sold} onChange={(e) => setSold(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
              Vendi ou perdi este bem
            </label>
            <p className="text-xs text-muted">
              Uma data no passado completa o histórico. Na venda, o bem passa a valer R$ 0,00 a partir da data, e os meses antes continuam no gráfico.
            </p>
            {error && (
              <p role="alert" className="text-sm text-expense">
                {error}
              </p>
            )}
            <Button className="justify-self-start" loading={add.isPending} onClick={save}>
              Salvar valor
            </Button>
          </div>

          <section aria-label="Histórico de valores" className="grid gap-2">
            <h3 className="font-semibold">Histórico de valores</h3>
            <ul className="grid gap-1">
              {valuations.map((v) => (
                <li
                  key={v.id}
                  aria-label={`${formatDate(v.date)}: ${formatBRL(v.amount)}`}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2"
                >
                  <span className="text-muted">{formatDate(v.date)}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular font-semibold">{formatBRL(v.amount)}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Excluir o valor de ${formatDate(v.date)}`}
                      title={valuations.length === 1 ? 'O único valor do bem não pode ser excluído.' : undefined}
                      disabled={valuations.length === 1 || removeValuation.isPending}
                      onClick={() => deleteValuation(v.id)}
                    >
                      <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4">
            {confirming ? (
              <div className="grid gap-2 text-sm">
                <span>
                  Excluir o bem e todo o histórico? Ele sai também dos meses passados do gráfico. Se você vendeu, prefira “Vendi ou perdi este bem”.
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="bg-expense text-white" loading={removeAsset.isPending} onClick={deleteAsset}>
                    Confirmar exclusão
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" className="text-expense" onClick={() => setConfirming(true)}>
                Excluir bem
              </Button>
            )}
            {!confirming && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Editar bem
              </Button>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
