import type { AssetKind, AssetValuationEntry, DateOnly } from '@fincontrol/shared';
import { fromDateOnly, toDateOnly } from '../../infra/date-mapping';
import type { Db } from '../../infra/prisma';

export type AssetValuationRow = AssetValuationEntry & { id: string };
export type AssetRow = { id: string; name: string; kind: AssetKind; valuations: AssetValuationRow[] };

type AssetRecord = {
  id: string; name: string; kind: AssetKind;
  valuations: { id: string; date: Date; amount: bigint; recordedAt: Date }[];
};

const withValuations = { valuations: { select: { id: true, date: true, amount: true, recordedAt: true } } } as const;

const toRow = (a: AssetRecord): AssetRow => ({
  id: a.id,
  name: a.name,
  kind: a.kind,
  valuations: a.valuations.map((v) => ({ id: v.id, date: toDateOnly(v.date), amount: Number(v.amount), recordedAt: v.recordedAt.toISOString() })),
});

/** B6: o bem não pode ficar sem nenhum registro de valor. */
export class OnlyValuationError extends Error {}

export function createAssetsRepository(db: Db) {
  return {
    async list(userId: string): Promise<AssetRow[]> {
      const rows = await db.asset.findMany({ where: { userId }, include: withValuations, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
      return rows.map(toRow);
    },

    async findById(userId: string, id: string): Promise<AssetRow | null> {
      const row = await db.asset.findFirst({ where: { id, userId }, include: withValuations });
      return row ? toRow(row) : null;
    },

    /** O bem e os registros (B5) numa transação, com `recordedAt` na ordem da lista. */
    async create(userId: string, a: { name: string; kind: AssetKind }, valuations: { date: DateOnly; amount: number }[]): Promise<string> {
      const now = Date.now();
      return db.$transaction(async (tx) => {
        const created = await tx.asset.create({ data: { userId, name: a.name, kind: a.kind }, select: { id: true } });
        await tx.assetValuation.createMany({
          data: valuations.map((v, i) => ({
            assetId: created.id, userId, date: fromDateOnly(v.date), amount: BigInt(v.amount), recordedAt: new Date(now + i),
          })),
        });
        return created.id;
      });
    },

    async update(userId: string, id: string, a: { name?: string; kind?: AssetKind }): Promise<void> {
      await db.asset.update({
        where: { id, userId },
        data: { ...(a.name !== undefined ? { name: a.name } : {}), ...(a.kind !== undefined ? { kind: a.kind } : {}) },
      });
    },

    /** B7: o histórico vai junto (FK em cascata). */
    async delete(userId: string, id: string): Promise<void> {
      await db.asset.delete({ where: { id, userId } });
    },

    async addValuation(userId: string, assetId: string, v: { date: DateOnly; amount: number }): Promise<void> {
      await db.assetValuation.create({ data: { assetId, userId, date: fromDateOnly(v.date), amount: BigInt(v.amount), recordedAt: new Date() } });
    },

    /** Trava o bem: dois pedidos juntos não apagam os dois últimos registros (B6). */
    async deleteValuation(userId: string, assetId: string, valuationId: string): Promise<boolean> {
      return db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "assets" WHERE "id" = ${assetId}::uuid FOR UPDATE`;
        const row = await tx.assetValuation.findFirst({ where: { id: valuationId, assetId, userId }, select: { id: true } });
        if (!row) return false;
        if ((await tx.assetValuation.count({ where: { assetId } })) <= 1) throw new OnlyValuationError();
        await tx.assetValuation.delete({ where: { id: valuationId } });
        return true;
      });
    },
  };
}

export type AssetsRepository = ReturnType<typeof createAssetsRepository>;
