import { tagSchema, type TagDTO } from '@fincontrol/shared';
import { Hash } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/field';
import { Panel } from '../../components/ui/panel';
import { ErrorState, ListSkeleton } from '../../components/ui/states';
import { useDeleteTag, useRenameTag, useTags } from './api';

function TagItem({ tag }: { tag: TagDTO }) {
  const rename = useRenameTag();
  const remove = useDeleteTag();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const errorId = useId();

  function startEditing() {
    setName(tag.name);
    setError(null);
    setEditing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    // T2 conferida aqui, com a mensagem certa: a API só diria "Um ou mais campos são inválidos".
    const parsed = tagSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Tag inválida');
      return;
    }
    try {
      const saved = await rename.mutateAsync({ from: tag.name, to: name });
      toast.success(saved.name === tag.name ? 'Nada mudou.' : `Tag renomeada para #${saved.name}.`);
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível renomear.');
    }
  }

  async function confirmDelete() {
    try {
      await remove.mutateAsync(tag.name);
      toast.success(`Tag #${tag.name} excluída.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir.');
    }
  }

  return (
    <li aria-label={`#${tag.name}`} className="grid gap-2 px-5 py-3">
      {editing ? (
        <form onSubmit={save} className="flex flex-wrap items-center gap-2">
          <Input
            aria-label={`Novo nome da tag ${tag.name}`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            maxLength={30}
            className="min-w-0 flex-1"
            autoFocus
          />
          <Button type="submit" size="sm" loading={rename.isPending}>
            Salvar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 truncate font-medium">{`#${tag.name}`}</span>
          <span className="flex items-center gap-1">
            <span className="mr-2 text-sm text-muted">{`${tag.count} ${tag.count === 1 ? 'lançamento' : 'lançamentos'}`}</span>
            {confirming ? (
              <>
                <Button size="sm" className="bg-expense text-white" loading={remove.isPending} onClick={confirmDelete}>
                  Confirmar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={startEditing}>
                  Renomear
                </Button>
                <Button size="sm" variant="ghost" className="text-expense" onClick={() => setConfirming(true)}>
                  Excluir
                </Button>
              </>
            )}
          </span>
        </div>
      )}
      {editing && error && (
        <p id={errorId} className="text-xs font-medium text-expense">
          {error}
        </p>
      )}
      {confirming && <p className="text-xs text-muted">A tag sai dos lançamentos e das recorrências; os lançamentos continuam.</p>}
    </li>
  );
}

/** Tags (sub-projeto 13, T6): renomear para o nome de outra tag junta as duas. */
export function TagsSection() {
  const tags = useTags();
  return (
    <section aria-label="Tags" className="mt-10 grid gap-4">
      <div>
        <h2 className="inline-flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
          <Hash aria-hidden className="h-5 w-5 text-primary" strokeWidth={1.75} />
          Tags
        </h2>
        <p className="mt-1 max-w-[60ch] text-sm text-muted">
          Juntam lançamentos de categorias diferentes, como “bebida” no mercado e no bar. Você marca as tags ao lançar.
        </p>
      </div>
      {tags.isPending && <ListSkeleton rows={2} />}
      {tags.isError && <ErrorState message={tags.error.message} onRetry={() => tags.refetch()} />}
      {tags.data && tags.data.length === 0 && <p className="text-sm text-muted">Nenhuma tag ainda.</p>}
      {tags.data && tags.data.length > 0 && (
        <Panel>
          <ul className="divide-y divide-border">
            {tags.data.map((t) => (
              <TagItem key={t.name} tag={t} />
            ))}
          </ul>
        </Panel>
      )}
    </section>
  );
}
