import type { CategoryDTO, CategoryType } from '@fincontrol/shared';
import type { Db } from '../../infra/prisma';

export type CategoryRow = CategoryDTO;
type CategoryData = { name: string; type: CategoryType; icon: string; color: string };

const select = { id: true, name: true, type: true, icon: true, color: true, parentId: true } as const;

/** A categoria e as subcategorias dela (sub-projeto 15, U9): a exclusão leva todas num comando só. */
const withChildren = (userId: string, id: string) => ({ userId, OR: [{ id }, { parentId: id }] });

export function createCategoriesRepository(db: Db) {
  return {
    list(userId: string, type?: CategoryType): Promise<CategoryRow[]> {
      return db.category.findMany({
        where: { userId, ...(type ? { type } : {}) },
        select,
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      });
    },

    findById(userId: string, id: string): Promise<CategoryRow | null> {
      return db.category.findFirst({ where: { id, userId }, select });
    },

    /** O nome é único por tipo, contando categorias e subcategorias (sub-projeto 15, U3). */
    findByName(userId: string, type: CategoryType, name: string, exceptId?: string): Promise<CategoryRow | null> {
      return db.category.findFirst({
        where: { userId, type, name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
        select,
      });
    },

    /** Cria se não existir, sem corrida: `ON CONFLICT DO NOTHING` (skipDuplicates) e depois lê a linha. */
    async ensure(userId: string, data: CategoryData): Promise<CategoryRow> {
      await db.category.createMany({ data: [{ ...data, userId }], skipDuplicates: true });
      return db.category.findFirstOrThrow({ where: { userId, type: data.type, name: data.name }, select });
    },

    create(userId: string, data: CategoryData): Promise<CategoryRow> {
      return db.category.create({ data: { ...data, userId }, select });
    },

    /** U2: o tipo, o ícone e a cor vêm da categoria. */
    createSubcategory(userId: string, parent: CategoryRow, name: string): Promise<CategoryRow> {
      return db.category.create({ data: { userId, name, type: parent.type, icon: parent.icon, color: parent.color, parentId: parent.id }, select });
    },

    /** U2: o ícone e a cor da categoria valem também para as subcategorias dela. */
    async update(userId: string, id: string, data: Partial<Omit<CategoryData, 'type'>>): Promise<CategoryRow> {
      const { icon, color } = data;
      if (icon === undefined && color === undefined) return db.category.update({ where: { id, userId }, data, select });
      const [row] = await db.$transaction([
        db.category.update({ where: { id, userId }, data, select }),
        db.category.updateMany({ where: { userId, parentId: id }, data: { ...(icon !== undefined ? { icon } : {}), ...(color !== undefined ? { color } : {}) } }),
      ]);
      return row;
    },

    async childIds(userId: string, id: string): Promise<string[]> {
      return (await db.category.findMany({ where: { userId, parentId: id }, select: { id: true } })).map((c) => c.id);
    },

    async deleteWithChildren(userId: string, id: string): Promise<void> {
      await db.category.deleteMany({ where: withChildren(userId, id) });
    },

    async isInUse(userId: string, ids: string[]): Promise<boolean> {
      const [transactions, recurrences] = await Promise.all([
        db.transaction.count({ where: { userId, categoryId: { in: ids } } }),
        db.recurrence.count({ where: { userId, categoryId: { in: ids } } }),
      ]);
      return transactions + recurrences > 0;
    },

    /**
     * Move lançamentos e recorrências da categoria e das subcategorias dela e apaga todas (U9). O limite da origem
     * passa para a categoria principal do destino quando ela não tem limite; quando tem, fica o dela (spec do
     * sub-projeto 4, R13 a). Subcategorias não têm limite (U6).
     */
    async reassignAndDelete(userId: string, fromId: string, to: CategoryRow): Promise<void> {
      await db.$transaction(async (tx) => {
        const ids = [fromId, ...(await tx.category.findMany({ where: { userId, parentId: fromId }, select: { id: true } })).map((c) => c.id)];
        await tx.transaction.updateMany({ where: { userId, categoryId: { in: ids } }, data: { categoryId: to.id } });
        await tx.recurrence.updateMany({ where: { userId, categoryId: { in: ids } }, data: { categoryId: to.id } });
        const budgetTarget = to.parentId ?? to.id;
        const targetBudget = await tx.budget.findUnique({ where: { userId_categoryId: { userId, categoryId: budgetTarget } } });
        if (!targetBudget) await tx.budget.updateMany({ where: { userId, categoryId: fromId }, data: { categoryId: budgetTarget } });
        await tx.category.deleteMany({ where: withChildren(userId, fromId) });
      });
    },
  };
}

export type CategoriesRepository = ReturnType<typeof createCategoriesRepository>;
