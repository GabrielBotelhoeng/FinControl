/** Subcategorias (spec do sub-projeto 15). */

type CategoryRef = { id: string; name: string; parentId: string | null };

/** U4: o rótulo da subcategoria leva a categoria na frente ("Alimentação › Restaurante"). */
export const SUBCATEGORY_SEPARATOR = ' › ';

/** U4: "Alimentação › Restaurante"; sem a categoria principal, só o nome. */
export const categoryPath = (name: string, parentName?: string | null): string => (parentName ? `${parentName}${SUBCATEGORY_SEPARATOR}${name}` : name);

export function categoryLabel(category: Omit<CategoryRef, 'id'>, byId: ReadonlyMap<string, { name: string }>): string {
  return categoryPath(category.name, category.parentId ? byId.get(category.parentId)?.name : null);
}

/** U5: os totais juntam a subcategoria na categoria principal. */
export const rootCategoryId = (category: Pick<CategoryRef, 'id' | 'parentId'>): string => category.parentId ?? category.id;
