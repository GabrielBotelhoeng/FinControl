import { categoryLabel, type CategoryDTO, type CategoryType } from '@fincontrol/shared';

const byName = (a: CategoryDTO, b: CategoryDTO) => a.name.localeCompare(b.name, 'pt-BR');

export type CategoryOption = { id: string; label: string; depth: 0 | 1 };

/** Sub-projeto 15 (U4): cada categoria principal seguida das subcategorias dela ("Alimentação › Restaurante"), em ordem alfabética. */
export function categoryOptions(list: CategoryDTO[], type: CategoryType): CategoryOption[] {
  const ofType = list.filter((c) => c.type === type);
  const byId = new Map(ofType.map((c) => [c.id, c]));
  // `!parentId`: durante o deploy, a API antiga ainda não manda o campo.
  return ofType
    .filter((c) => !c.parentId)
    .sort(byName)
    .flatMap((root) => [
      { id: root.id, label: root.name, depth: 0 as const },
      ...ofType
        .filter((c) => c.parentId === root.id)
        .sort(byName)
        .map((c) => ({ id: c.id, label: categoryLabel(c, byId), depth: 1 as const })),
    ]);
}

/** A categoria do lançamento e a principal dela, para a linha mostrar "Alimentação › Restaurante" (U4). */
export function categoryOf(byId: ReadonlyMap<string, CategoryDTO>, id: string | null): { category: CategoryDTO | undefined; parent: CategoryDTO | undefined } {
  const category = id ? byId.get(id) : undefined;
  return { category, parent: category?.parentId ? byId.get(category.parentId) : undefined };
}
