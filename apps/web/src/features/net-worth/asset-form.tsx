import { ASSET_KIND_LABELS, assetKindSchema, todayInSaoPaulo, type AssetDTO, type AssetKind } from '@fincontrol/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Field, Input, Select } from '../../components/ui/field';
import { MoneyInput } from '../../components/ui/money-input';
import { ApiError } from '../../lib/api-client';
import { useCreateAsset, useUpdateAsset } from './api';

const KINDS = assetKindSchema.options;

/** Cadastro do bem (B5) ou, com `asset`, a edição do nome e do tipo. */
export function AssetForm({ asset, onOpenChange }: { asset?: Pick<AssetDTO, 'id' | 'name' | 'kind'>; onOpenChange: (open: boolean) => void }) {
  const create = useCreateAsset();
  const update = useUpdateAsset();
  const pending = create.isPending || update.isPending;
  const today = todayInSaoPaulo();
  const [name, setName] = useState(asset?.name ?? '');
  const [kind, setKind] = useState<AssetKind>(asset?.kind ?? 'property');
  const [value, setValue] = useState<number | null>(null);
  const [since, setSince] = useState(today);
  const [purchase, setPurchase] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // B5: o valor na compra só faz sentido com uma data no passado.
  const past = since !== '' && since < today;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Dê um nome para o bem.';
    if (!asset && !value) next.value = 'Informe quanto o bem vale hoje.';
    if (!asset && (!since || since > today)) next.since = 'A data não pode estar no futuro.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    try {
      if (asset) {
        await update.mutateAsync({ id: asset.id, name: name.trim(), kind });
        toast.success('Bem atualizado.');
      } else {
        await create.mutateAsync({ name: name.trim(), kind, value: value!, since, ...(past && purchase ? { purchaseValue: purchase } : {}) });
        toast.success('Bem cadastrado.');
      }
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.length) setErrors(Object.fromEntries(err.fieldErrors.map((f) => [f.path, f.message])));
      else toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.');
    }
  }

  return (
    <Dialog open onOpenChange={(o) => (o || !pending) && onOpenChange(o)} title={asset ? 'Editar bem' : 'Novo bem'}>
      <form onSubmit={submit} className="grid gap-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" error={errors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex.: Apartamento" autoFocus />
          </Field>
          <Field label="Tipo" error={errors.kind}>
            <Select value={kind} onChange={(e) => setKind(e.target.value as AssetKind)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {ASSET_KIND_LABELS[k]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {kind === 'investment' && (
          <p className="rounded-[var(--radius-control)] border border-border bg-surface-2 p-4 text-sm">
            Um investimento que já é conta do tipo “Investimento” em Contas já entra pelo saldo da conta: não cadastre de novo aqui.
          </p>
        )}
        {!asset && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valor hoje" hint="Quanto o bem vale hoje, se fosse vendido." error={errors.value}>
                <MoneyInput value={value} onChange={setValue} />
              </Field>
              <Field label="Desde quando você tem" hint="Para o gráfico não mostrar o bem como ganho neste mês." error={errors.since}>
                <Input type="date" value={since} min="1900-01-01" max={today} onChange={(e) => setSince(e.target.value)} />
              </Field>
            </div>
            {past && (
              <Field label="Valor na compra (opcional)" hint="Quanto valia naquela data. Sem ele, vale o valor de hoje." error={errors.purchaseValue}>
                <MoneyInput value={purchase} onChange={setPurchase} />
              </Field>
            )}
          </>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" loading={pending}>
            Salvar bem
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
