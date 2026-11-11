import type { CategoryDTO } from '@fincontrol/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Field, Select } from '../../components/ui/field';
import { ApiError } from '../../lib/api-client';
import { useDeleteCategory } from './api';

type Props = { category: CategoryDTO; siblings: CategoryDTO[]; onClose: () => void };

/** Exclui direto; se a API responder 409 (em uso), pede a categoria que recebe os lançamentos. */
export function DeleteCategoryDialog({ category, siblings, onClose }: Props) {
  const remove = useDeleteCategory();
  const options = siblings.filter((c) => c.id !== category.id);
  const [inUse, setInUse] = useState(false);
  const [target, setTarget] = useState(options[0]?.id ?? '');

  async function run(reassignTo?: string) {
    try {
      await remove.mutateAsync({ id: category.id, ...(reassignTo ? { reassignTo } : {}) });
      toast.success('Categoria excluída.');
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setInUse(true);
      else toast.error(err instanceof Error ? err.message : 'Não foi possível excluir.');
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Excluir “${category.name}”`} description={inUse ? 'Esta categoria tem lançamentos. Escolha para onde eles vão antes de excluir.' : 'Esta ação não pode ser desfeita.'}>
      {inUse ? (
        <div className="grid gap-5">
          <Field label="Mover os lançamentos para">
            <Select value={target} onChange={(e) => setTarget(e.target.value)}>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="danger" loading={remove.isPending} disabled={!target} onClick={() => run(target)}>
              Mover e excluir
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" loading={remove.isPending} onClick={() => run()}>
            Excluir
          </Button>
        </div>
      )}
    </Dialog>
  );
}
