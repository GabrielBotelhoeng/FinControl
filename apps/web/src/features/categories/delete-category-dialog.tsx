import { monthOf, todayInSaoPaulo, type CategoryDTO } from '@fincontrol/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Field, Select } from '../../components/ui/field';
import { ApiError } from '../../lib/api-client';
import { formatBRL } from '../../lib/format';
import { useBudgetMonth } from '../planning/api';
import { useDeleteCategory } from './api';
import { categoryOptions } from './tree';

type Props = { category: CategoryDTO; siblings: CategoryDTO[]; onClose: () => void };

/**
 * O que acontece com o limite ao juntar categorias de despesa (spec do sub-projeto 4, R13 a): passa para o
 * destino quando ele não tem; quando os dois têm, o destino fica com o dele e o da origem some.
 */
function BudgetMergeNote({ from, to }: { from: CategoryDTO; to: CategoryDTO | undefined }) {
  const budget = useBudgetMonth(monthOf(todayInSaoPaulo()));
  const limitOf = (id: string) => budget.data?.items.find((i) => i.categoryId === id)?.limit;
  const source = limitOf(from.id);
  if (!to || source === undefined) return null;
  const target = limitOf(to.id);
  return (
    <p role="note" className="text-sm text-muted">
      {target === undefined
        ? `O limite de ${formatBRL(source)} de “${from.name}” passa para “${to.name}”.`
        : `“${to.name}” já tem limite de ${formatBRL(target)} e fica com ele. O limite de ${formatBRL(source)} de “${from.name}” será removido.`}
    </p>
  );
}

/** Exclui direto; se a API responder 409 (em uso), pede a categoria que recebe os lançamentos. */
export function DeleteCategoryDialog({ category, siblings, onClose }: Props) {
  const remove = useDeleteCategory();
  // Sub-projeto 15 (U9): a categoria leva as subcategorias, que não podem ser o destino; o da subcategoria é a principal.
  const children = siblings.filter((c) => c.parentId === category.id);
  const removed = new Set([category.id, ...children.map((c) => c.id)]);
  const options = categoryOptions(siblings, category.type).filter((o) => !removed.has(o.id));
  const [inUse, setInUse] = useState(false);
  const [target, setTarget] = useState(category.parentId ?? options[0]?.id ?? '');
  const targetCategory = siblings.find((c) => c.id === target);
  // O limite vai para a categoria principal do destino (R13 a).
  const targetRoot = targetCategory?.parentId ? siblings.find((c) => c.id === targetCategory.parentId) : targetCategory;

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
      {children.length > 0 && (
        <p role="note" className="mb-4 text-sm text-muted">
          {`As subcategorias ${children.map((c) => `“${c.name}”`).join(', ')} também serão excluídas.`}
        </p>
      )}
      {inUse ? (
        <div className="grid gap-5">
          <Field label="Mover os lançamentos para">
            <Select value={target} onChange={(e) => setTarget(e.target.value)}>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          {category.type === 'expense' && <BudgetMergeNote from={category} to={targetRoot} />}
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
