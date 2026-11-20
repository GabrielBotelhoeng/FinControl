import type { Db, DbClient } from '../../infra/prisma';
import { UnauthorizedError } from '../../http/errors';
import { isUniqueViolation } from '../../infra/prisma-errors';
import type { AuthClaims } from '../../infra/token-verifier';
import { DEFAULT_CATEGORIES } from './default-categories';

export type Provisioner = { ensure(claims: AuthClaims): Promise<void>; forget(userId: string): void };

function displayName(claims: AuthClaims): string {
  if (claims.name) return claims.name;
  if (claims.email) return claims.email.split('@')[0] ?? 'Visitante';
  return 'Visitante';
}

/** Trava por usuário, até o fim da transação, compartilhada pela criação e pela exclusão do perfil. */
export async function lockProfile(tx: DbClient, userId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('profile'), hashtext(${userId}))`;
}

/** Cria o perfil e as categorias padrão no primeiro acesso. É idempotente e seguro com requisições concorrentes. */
export function createProvisioner(db: Db): Provisioner {
  const known = new Set<string>();
  return {
    async ensure(claims) {
      if (known.has(claims.userId)) return;
      const existing = await db.profile.findUnique({ where: { id: claims.userId }, select: { id: true } });
      if (!existing) {
        try {
          await db.$transaction(async (tx) => {
            // Mesma trava da exclusão (profile.repository): criar e excluir o mesmo usuário nunca se cruzam (CodeRabbit).
            await lockProfile(tx, claims.userId);
            // Auditoria final (LGPD): conta excluída não volta a existir com o token que ainda não expirou.
            if (await tx.deletedUser.findUnique({ where: { id: claims.userId }, select: { id: true } })) throw new UnauthorizedError();
            if (await tx.profile.findUnique({ where: { id: claims.userId }, select: { id: true } })) return;
            await tx.profile.create({ data: { id: claims.userId, name: displayName(claims), isDemo: claims.isAnonymous } });
            await tx.category.createMany({ data: DEFAULT_CATEGORIES.map((c) => ({ ...c, userId: claims.userId })) });
          });
        } catch (err) {
          if (!isUniqueViolation(err)) throw err;
        }
      }
      known.add(claims.userId);
    },
    forget(userId) {
      known.delete(userId);
    },
  };
}
