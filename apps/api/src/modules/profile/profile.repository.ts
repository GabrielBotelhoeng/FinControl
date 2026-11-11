import type { UpdateProfileInput } from '@fincontrol/shared';
import type { Db } from '../../infra/prisma';

export function createProfileRepository(db: Db) {
  return {
    find(userId: string) {
      return db.profile.findUnique({ where: { id: userId } });
    },
    update(userId: string, data: UpdateProfileInput) {
      return db.profile.update({ where: { id: userId }, data });
    },
    async delete(userId: string) {
      await db.profile.deleteMany({ where: { id: userId } });
    },
  };
}

export type ProfileRepository = ReturnType<typeof createProfileRepository>;
