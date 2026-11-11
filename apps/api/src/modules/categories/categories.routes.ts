import {
  createCategorySchema, deleteCategoryQuerySchema, idSchema, listCategoriesQuerySchema, updateCategorySchema,
} from '@fincontrol/shared';
import { Router } from 'express';
import { userIdOf } from '../../http/auth';
import { parse } from '../../http/validate';
import type { CategoriesService } from './categories.service';

export function categoriesRouter(service: CategoriesService): Router {
  const r = Router();
  r.get('/', async (req, res) => {
    const { type } = parse(listCategoriesQuerySchema, req.query);
    res.json(await service.list(userIdOf(res), type));
  });
  r.post('/', async (req, res) => {
    res.status(201).json(await service.create(userIdOf(res), parse(createCategorySchema, req.body)));
  });
  r.patch('/:id', async (req, res) => {
    res.json(await service.update(userIdOf(res), parse(idSchema, req.params.id), parse(updateCategorySchema, req.body)));
  });
  r.delete('/:id', async (req, res) => {
    const { reassignTo } = parse(deleteCategoryQuerySchema, req.query);
    await service.remove(userIdOf(res), parse(idSchema, req.params.id), reassignTo);
    res.status(204).end();
  });
  return r;
}
