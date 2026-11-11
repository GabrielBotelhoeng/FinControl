import type { CategoryDTO, CategoryType } from '@fincontrol/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Field, Input } from '../../components/ui/field';
import { SwatchPicker } from '../../components/ui/swatch-picker';
import { ApiError } from '../../lib/api-client';
import { cn } from '../../lib/cn';
import { SWATCHES } from '../../lib/swatches';
import { useSaveCategory } from './api';
import { CATEGORY_ICONS } from './icons';

type Props = { open: boolean; onOpenChange: (o: boolean) => void; type: CategoryType; category?: CategoryDTO };

export function CategoryForm({ open, onOpenChange, type, category }: Props) {
  const save = useSaveCategory();
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? 'shopping-bag');
  const [color, setColor] = useState<string>(category?.color ?? SWATCHES[1]);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Dê um nome para a categoria.');
    try {
      await save.mutateAsync({ id: category?.id, name: name.trim(), type, icon, color });
      toast.success(category ? 'Categoria atualizada.' : 'Categoria criada.');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={category ? 'Editar categoria' : `Nova categoria de ${type === 'expense' ? 'despesa' : 'receita'}`}>
      <form onSubmit={submit} className="grid gap-5" noValidate>
        <Field label="Nome" error={error ?? undefined}>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Ícone</legend>
          <div role="radiogroup" aria-label="Ícone" className="grid grid-cols-6 gap-2 sm:grid-cols-8">
            {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={icon === key}
                aria-label={key}
                onClick={() => setIcon(key)}
                className={cn('grid h-10 place-items-center rounded-[var(--radius-control)] border transition-colors', icon === key ? 'border-primary bg-primary-soft text-text' : 'border-border text-muted hover:text-text')}
              >
                <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </button>
            ))}
          </div>
        </fieldset>
        <SwatchPicker value={color} onChange={setColor} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.isPending}>
            Salvar categoria
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
