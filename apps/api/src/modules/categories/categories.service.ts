import type { CategoryDTO, CategoryType, CreateCategoryInput, UpdateCategoryInput } from '@fincontrol/shared';
import { ConflictError, NotFoundError, UnprocessableError } from '../../http/errors';
import type { CategoriesRepository, CategoryRow } from './categories.repository';

export function createCategoriesService(repo: CategoriesRepository) {
  async function getOwned(userId: string, id: string): Promise<CategoryRow> {
    const category = await repo.findById(userId, id);
    if (!category) throw new NotFoundError('Categoria');
    return category;
  }

  async function assertNameFree(userId: string, type: CategoryType, name: string, exceptId?: string): Promise<void> {
    if (await repo.findByName(userId, type, name, exceptId)) throw new ConflictError('Já existe uma categoria com esse nome.');
  }

  return {
    list(userId: string, type?: CategoryType): Promise<CategoryDTO[]> {
      return repo.list(userId, type);
    },

    async create(userId: string, input: CreateCategoryInput): Promise<CategoryDTO> {
      await assertNameFree(userId, input.type, input.name);
      return repo.create(userId, input);
    },

    async update(userId: string, id: string, input: UpdateCategoryInput): Promise<CategoryDTO> {
      const current = await getOwned(userId, id);
      if (input.name !== undefined) await assertNameFree(userId, current.type, input.name, id);
      return repo.update(userId, id, input);
    },

    async remove(userId: string, id: string, reassignTo?: string): Promise<void> {
      const current = await getOwned(userId, id);
      if (!(await repo.isInUse(userId, id))) {
        await repo.delete(userId, id);
        return;
      }
      if (!reassignTo) {
        throw new ConflictError('A categoria está em uso. Informe em reassignTo a categoria que receberá os lançamentos.');
      }
      const target = await getOwned(userId, reassignTo);
      if (target.id === current.id || target.type !== current.type) {
        throw new UnprocessableError('A categoria de destino deve ser outra categoria do mesmo tipo.');
      }
      await repo.reassignAndDelete(userId, current.id, target.id);
    },

    async assertMatches(userId: string, categoryId: string, type: CategoryType): Promise<void> {
      const category = await getOwned(userId, categoryId);
      if (category.type !== type) throw new UnprocessableError('A categoria não corresponde ao tipo do lançamento.');
    },
  };
}

export type CategoriesService = ReturnType<typeof createCategoriesService>;
