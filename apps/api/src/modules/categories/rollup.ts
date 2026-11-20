import type { DbClient } from '../../infra/prisma';

/** Sub-projeto 15 (U5): de cada subcategoria da pessoa para a categoria principal dela. */
export async function subcategoryParents(db: DbClient, userId: string): Promise<Map<string, string>> {
  const rows = await db.category.findMany({ where: { userId, parentId: { not: null } }, select: { id: true, parentId: true } });
  return new Map(rows.map((r) => [r.id, r.parentId!]));
}

/** U5: junta os valores de cada subcategoria nos da categoria principal. */
export function foldIntoParents<T>(byCategory: Map<string, T>, parents: Map<string, string>, add: (a: T, b: T) => T): Map<string, T> {
  const out = new Map<string, T>();
  for (const [id, value] of byCategory) {
    const root = parents.get(id) ?? id;
    const current = out.get(root);
    out.set(root, current === undefined ? value : add(current, value));
  }
  return out;
}
