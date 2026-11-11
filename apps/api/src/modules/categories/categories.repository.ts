import type { CategoryDTO, CategoryType } from '@fincontrol/shared';
import type { Db } from '../../infra/prisma';

export type CategoryRow = CategoryDTO;
type CategoryData = { name: string; type: CategoryType; icon: string; color: string };

const select = { id: true, name: true, type: true, icon: true, color: true } as const;

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

    findByName(userId: string, type: CategoryType, name: string, exceptId?: string): Promise<CategoryRow | null> {
      return db.category.findFirst({
        where: { userId, type, name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
        select,
      });
    },

    create(userId: string, data: CategoryData): Promise<CategoryRow> {
      return db.category.create({ data: { ...data, userId }, select });
    },

    update(userId: string, id: string, data: Partial<Omit<CategoryData, 'type'>>): Promise<CategoryRow> {
      return db.category.update({ where: { id, userId }, data, select });
    },

    async delete(userId: string, id: string): Promise<void> {
      await db.category.delete({ where: { id, userId } });
    },

    async isInUse(userId: string, id: string): Promise<boolean> {
      const [transactions, recurrences] = await Promise.all([
        db.transaction.count({ where: { userId, categoryId: id } }),
        db.recurrence.count({ where: { userId, categoryId: id } }),
      ]);
      return transactions + recurrences > 0;
    },

    async reassignAndDelete(userId: string, fromId: string, toId: string): Promise<void> {
      await db.$transaction([
        db.transaction.updateMany({ where: { userId, categoryId: fromId }, data: { categoryId: toId } }),
        db.recurrence.updateMany({ where: { userId, categoryId: fromId }, data: { categoryId: toId } }),
        db.category.delete({ where: { id: fromId, userId } }),
      ]);
    },
  };
}

export type CategoriesRepository = ReturnType<typeof createCategoriesRepository>;
