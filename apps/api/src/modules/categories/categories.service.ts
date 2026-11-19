import type { CategoryDTO, CategoryType, CreateCategoryInput, CreateSubcategoryInput, UpdateCategoryInput } from '@fincontrol/shared';
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

    /** Sub-projeto 15 (U1–U3): um nível só, com o tipo, o ícone e a cor da categoria. */
    async createSubcategory(userId: string, parentId: string, input: CreateSubcategoryInput): Promise<CategoryDTO> {
      const parent = await getOwned(userId, parentId);
      if (parent.parentId) throw new UnprocessableError('Uma subcategoria não pode ter subcategorias.');
      await assertNameFree(userId, parent.type, input.name);
      return repo.createSubcategory(userId, parent, input.name);
    },

    async update(userId: string, id: string, input: UpdateCategoryInput): Promise<CategoryDTO> {
      const current = await getOwned(userId, id);
      if (current.parentId && (input.icon !== undefined || input.color !== undefined)) {
        throw new UnprocessableError('O ícone e a cor da subcategoria vêm da categoria.');
      }
      if (input.name !== undefined) await assertNameFree(userId, current.type, input.name, id);
      return repo.update(userId, id, input);
    },

    /** U9: a categoria leva as subcategorias; os lançamentos de todas vão para o destino, que não pode ser uma delas. */
    async remove(userId: string, id: string, reassignTo?: string): Promise<void> {
      const current = await getOwned(userId, id);
      const removed = [id, ...(current.parentId ? [] : await repo.childIds(userId, id))];
      if (!(await repo.isInUse(userId, removed))) {
        await repo.deleteWithChildren(userId, id);
        return;
      }
      if (!reassignTo) {
        throw new ConflictError('A categoria está em uso. Informe em reassignTo a categoria que receberá os lançamentos.');
      }
      const target = await getOwned(userId, reassignTo);
      if (target.id === current.id || target.type !== current.type) {
        throw new UnprocessableError('A categoria de destino deve ser outra categoria do mesmo tipo.');
      }
      if (removed.includes(target.id)) throw new UnprocessableError('O destino não pode ser uma subcategoria da categoria excluída.');
      await repo.reassignAndDelete(userId, current.id, target);
    },

    async assertMatches(userId: string, categoryId: string, type: CategoryType): Promise<void> {
      const category = await getOwned(userId, categoryId);
      if (category.type !== type) throw new UnprocessableError('A categoria não corresponde ao tipo do lançamento.');
    },
  };
}

export type CategoriesService = ReturnType<typeof createCategoriesService>;
