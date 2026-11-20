import type { UpdateProfileInput } from '@fincontrol/shared';
import type { Db } from '../../infra/prisma';
import { lockProfile } from './provisioning';

export function createProfileRepository(db: Db) {
  return {
    find(userId: string) {
      return db.profile.findUnique({ where: { id: userId } });
    },
    update(userId: string, data: UpdateProfileInput) {
      return db.profile.update({ where: { id: userId }, data });
    },
    /** Assistente com IA (A5): quando aceitou, ou `null` para retirar. */
    async setAiConsent(userId: string, at: Date | null) {
      await db.profile.update({ where: { id: userId }, data: { aiConsentAt: at } });
    },
    /**
     * Apaga o perfil (cascata para todos os dados) e guarda o id em `deleted_users`, na mesma transação: um token
     * antigo, ainda válido, não recria o perfil depois (auditoria final, LGPD).
     */
    async delete(userId: string, remember = true) {
      await db.$transaction(async (tx) => {
        await lockProfile(tx, userId);
        if (remember) await tx.deletedUser.createMany({ data: [{ id: userId }], skipDuplicates: true });
        await tx.profile.deleteMany({ where: { id: userId } });
      });
    },
    /** Desfaz a marca de `delete` quando a exclusão no Auth falha: a pessoa ainda existe e precisa poder voltar. */
    async forgetDeleted(userId: string) {
      await db.deletedUser.deleteMany({ where: { id: userId } });
    },
  };
}

export type ProfileRepository = ReturnType<typeof createProfileRepository>;
