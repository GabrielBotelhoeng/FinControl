import type { CategoryDTO, CategoryType } from '@fincontrol/shared';
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { PageHeader } from '../../components/ui/page-header';
import { Panel } from '../../components/ui/panel';
import { Segmented } from '../../components/ui/segmented';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/ui/states';
import { useCategories } from './api';
import { CategoryForm } from './category-form';
import { DeleteCategoryDialog } from './delete-category-dialog';
import { iconFor } from './icons';

export default function CategoriesPage() {
  const categories = useCategories();
  const [type, setType] = useState<CategoryType>('expense');
  const [editing, setEditing] = useState<CategoryDTO | 'new' | null>(null);
  const [deleting, setDeleting] = useState<CategoryDTO | null>(null);
  const list = (categories.data ?? []).filter((c) => c.type === type);

  return (
    <>
      <PageHeader
        light="Suas"
        bold="categorias"
        description="Organize para onde vai e de onde vem o dinheiro. Os gráficos do painel usam estas cores."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            Nova categoria
          </Button>
        }
      />
      <Segmented
        label="Tipo de categoria"
        className="mb-6"
        value={type}
        onChange={setType}
        options={[
          { value: 'expense', label: 'Despesas' },
          { value: 'income', label: 'Receitas' },
        ]}
      />

      {categories.isPending && <ListSkeleton rows={6} />}
      {categories.isError && <ErrorState message={categories.error.message} onRetry={() => categories.refetch()} />}
      {categories.data && list.length === 0 && (
        <EmptyState icon={<Tags className="h-7 w-7" strokeWidth={1.5} />} title="Nenhuma categoria aqui" description="Crie uma categoria para classificar seus lançamentos." />
      )}
      {list.length > 0 && (
        <Panel>
          <ul className="divide-y divide-border">
            {list.map((c) => {
              const Icon = iconFor(c.icon);
              return (
                <li key={c.id} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ backgroundColor: `${c.color}22`, color: c.color }}>
                    <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  </span>
                  <span className="flex-1 font-medium">{c.name}</span>
                  <Button variant="ghost" size="icon" aria-label={`Editar ${c.name}`} onClick={() => setEditing(c)}>
                    <Pencil aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={`Excluir ${c.name}`} onClick={() => setDeleting(c)}>
                    <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  </Button>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {editing && <CategoryForm open onOpenChange={(o) => !o && setEditing(null)} type={type} {...(editing === 'new' ? {} : { category: editing })} />}
      {deleting && <DeleteCategoryDialog category={deleting} siblings={list} onClose={() => setDeleting(null)} />}
    </>
  );
}
