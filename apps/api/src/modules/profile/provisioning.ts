import type { Db } from '../../infra/prisma';
import { isUniqueViolation } from '../../infra/prisma-errors';
import type { AuthClaims } from '../../infra/token-verifier';
import { DEFAULT_CATEGORIES } from './default-categories';

export type Provisioner = { ensure(claims: AuthClaims): Promise<void>; forget(userId: string): void };

function displayName(claims: AuthClaims): string {
  if (claims.name) return claims.name;
  if (claims.email) return claims.email.split('@')[0] ?? 'Visitante';
  return 'Visitante';
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
          await db.$transaction([
            db.profile.create({ data: { id: claims.userId, name: displayName(claims), isDemo: claims.isAnonymous } }),
            db.category.createMany({ data: DEFAULT_CATEGORIES.map((c) => ({ ...c, userId: claims.userId })) }),
          ]);
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
