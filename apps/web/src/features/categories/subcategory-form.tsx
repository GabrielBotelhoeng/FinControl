import type { CategoryDTO } from '@fincontrol/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Field, Input } from '../../components/ui/field';
import { ApiError } from '../../lib/api-client';
import { useSaveSubcategory } from './api';

type Props = { parent: CategoryDTO; subcategory?: CategoryDTO | undefined; onClose: () => void };

/** Sub-projeto 15 (U2): a subcategoria só tem nome; o ícone e a cor são os da categoria. */
export function SubcategoryForm({ parent, subcategory, onClose }: Props) {
  const save = useSaveSubcategory();
  const [name, setName] = useState(subcategory?.name ?? '');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Dê um nome para a subcategoria.');
    try {
      await save.mutateAsync({ ...(subcategory ? { id: subcategory.id } : {}), parentId: parent.id, name: name.trim() });
      toast.success(subcategory ? 'Subcategoria renomeada.' : 'Subcategoria criada.');
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={subcategory ? 'Renomear subcategoria' : `Nova subcategoria em ${parent.name}`}
      description="A subcategoria usa o ícone e a cor da categoria, e o gasto dela entra no limite da categoria."
    >
      <form onSubmit={submit} className="grid gap-5" noValidate>
        <Field label="Nome" error={error ?? undefined}>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            maxLength={60}
            autoFocus
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
