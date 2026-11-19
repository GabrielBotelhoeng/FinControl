import { compareTags, renameTagSchema, tagSchema, type TagDTO } from '@fincontrol/shared';
import { Router } from 'express';
import { userIdOf } from '../../http/auth';
import { NotFoundError } from '../../http/errors';
import { parse } from '../../http/validate';
import type { Db } from '../../infra/prisma';

/**
 * Tags (sub-projeto 13, T6). Não há tabela de tags: cada uma existe enquanto algum lançamento a usa. Renomear e
 * excluir mexem nos lançamentos e no modelo das recorrências, para as próximas ocorrências seguirem a troca.
 */
export function createTagsService(deps: { db: Db }) {
  const { db } = deps;

  async function countOf(userId: string, name: string): Promise<number> {
    return db.transaction.count({ where: { userId, tags: { has: name } } });
  }

  async function assertUsed(userId: string, name: string): Promise<void> {
    const recurrences = await db.recurrence.count({ where: { userId, tags: { has: name } } });
    if ((await countOf(userId, name)) === 0 && recurrences === 0) throw new NotFoundError('Tag');
  }

  return {
    async list(userId: string): Promise<TagDTO[]> {
      const rows = await db.$queryRaw<{ name: string; count: number }[]>`
        SELECT tag AS "name", COUNT(*)::int AS "count"
        FROM "transactions", unnest("tags") AS tag
        WHERE "user_id" = ${userId}::uuid
        GROUP BY tag`;
      return rows.sort((a, b) => compareTags(a.name, b.name));
    },

    /** Renomear para o nome de outra tag junta as duas (sem repetir a tag no mesmo lançamento). */
    async rename(userId: string, from: string, to: string): Promise<TagDTO> {
      await assertUsed(userId, from);
      if (from !== to) {
        await db.$transaction([
          db.$executeRaw`
            UPDATE "transactions"
            SET "tags" = ARRAY(SELECT DISTINCT t FROM unnest(array_replace("tags", ${from}, ${to})) AS t), "updated_at" = now()
            WHERE "user_id" = ${userId}::uuid AND ${from} = ANY("tags")`,
          db.$executeRaw`
            UPDATE "recurrences"
            SET "tags" = ARRAY(SELECT DISTINCT t FROM unnest(array_replace("tags", ${from}, ${to})) AS t), "updated_at" = now()
            WHERE "user_id" = ${userId}::uuid AND ${from} = ANY("tags")`,
        ]);
      }
      return { name: to, count: await countOf(userId, to) };
    },

    async remove(userId: string, name: string): Promise<void> {
      await assertUsed(userId, name);
      await db.$transaction([
        db.$executeRaw`
          UPDATE "transactions" SET "tags" = array_remove("tags", ${name}), "updated_at" = now()
          WHERE "user_id" = ${userId}::uuid AND ${name} = ANY("tags")`,
        db.$executeRaw`
          UPDATE "recurrences" SET "tags" = array_remove("tags", ${name}), "updated_at" = now()
          WHERE "user_id" = ${userId}::uuid AND ${name} = ANY("tags")`,
      ]);
    },
  };
}

export type TagsService = ReturnType<typeof createTagsService>;

export function tagsRouter(service: TagsService): Router {
  const r = Router();
  r.get('/', async (_req, res) => {
    res.json(await service.list(userIdOf(res)));
  });
  r.patch('/:name', async (req, res) => {
    res.json(await service.rename(userIdOf(res), parse(tagSchema, req.params.name), parse(renameTagSchema, req.body).name));
  });
  r.delete('/:name', async (req, res) => {
    await service.remove(userIdOf(res), parse(tagSchema, req.params.name));
    res.status(204).end();
  });
  return r;
}
