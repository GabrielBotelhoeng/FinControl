import { z } from 'zod';
import { colorSchema, idSchema, nameSchema, NON_EMPTY_MESSAGE, nonEmpty } from './common';

export const categoryTypeSchema = z.enum(['income', 'expense']);
export type CategoryType = z.infer<typeof categoryTypeSchema>;

const iconSchema = z.string().trim().min(1, 'Obrigatório').max(40);

export const createCategorySchema = z.object({ name: nameSchema, type: categoryTypeSchema, icon: iconSchema, color: colorSchema });
export const updateCategorySchema = z
  .object({ name: nameSchema, icon: iconSchema, color: colorSchema })
  .partial()
  .refine(nonEmpty, NON_EMPTY_MESSAGE);
export const listCategoriesQuerySchema = z.object({ type: categoryTypeSchema.optional() });
export const deleteCategoryQuerySchema = z.object({ reassignTo: idSchema.optional() });

export type CreateCategoryInput = z.output<typeof createCategorySchema>;
export type UpdateCategoryInput = z.output<typeof updateCategorySchema>;

export type CategoryDTO = { id: string; name: string; type: CategoryType; icon: string; color: string };
