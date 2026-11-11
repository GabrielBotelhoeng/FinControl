import { idSchema } from '@fincontrol/shared';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export type AuthClaims = { userId: string; isAnonymous: boolean; email: string | null; name: string | null };

export interface TokenVerifier {
  verify(token: string): Promise<AuthClaims>;
}

const asString = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

export function createJwksVerifier(opts: { getKey: JWTVerifyGetKey; issuer: string }): TokenVerifier {
  return {
    async verify(token) {
      const { payload } = await jwtVerify(token, opts.getKey, { issuer: opts.issuer, audience: 'authenticated' });
      const sub = idSchema.parse(payload.sub);
      const meta = typeof payload.user_metadata === 'object' && payload.user_metadata !== null
        ? (payload.user_metadata as Record<string, unknown>)
        : {};
      return {
        userId: sub,
        isAnonymous: payload.is_anonymous === true,
        email: asString(payload.email),
        name: asString(meta.full_name) ?? asString(meta.name),
      };
    },
  };
}

/** Requer o projeto Supabase com JWT Signing Keys assimétricas (padrão em projetos novos). */
export function createSupabaseVerifier(supabaseUrl: string): TokenVerifier {
  return createJwksVerifier({
    getKey: createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)),
    issuer: `${supabaseUrl}/auth/v1`,
  });
}
