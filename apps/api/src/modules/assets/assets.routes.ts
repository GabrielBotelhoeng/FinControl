import { assetValuationSchema, createAssetSchema, idSchema, updateAssetSchema } from '@fincontrol/shared';
import { Router } from 'express';
import { userIdOf } from '../../http/auth';
import { parse } from '../../http/validate';
import type { AssetsService } from './assets.service';

export function assetsRouter(service: AssetsService): Router {
  const r = Router();
  r.get('/', async (_req, res) => {
    res.json(await service.list(userIdOf(res)));
  });
  r.post('/', async (req, res) => {
    res.status(201).json(await service.create(userIdOf(res), parse(createAssetSchema, req.body)));
  });
  r.get('/:id', async (req, res) => {
    res.json(await service.get(userIdOf(res), parse(idSchema, req.params.id)));
  });
  r.patch('/:id', async (req, res) => {
    res.json(await service.update(userIdOf(res), parse(idSchema, req.params.id), parse(updateAssetSchema, req.body)));
  });
  r.delete('/:id', async (req, res) => {
    await service.remove(userIdOf(res), parse(idSchema, req.params.id));
    res.status(204).end();
  });
  r.post('/:id/valuations', async (req, res) => {
    res.status(201).json(await service.addValuation(userIdOf(res), parse(idSchema, req.params.id), parse(assetValuationSchema, req.body)));
  });
  r.delete('/:id/valuations/:valuationId', async (req, res) => {
    await service.removeValuation(userIdOf(res), parse(idSchema, req.params.id), parse(idSchema, req.params.valuationId));
    res.status(204).end();
  });
  return r;
}
