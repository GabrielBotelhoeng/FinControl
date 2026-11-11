import { randomUUID } from 'node:crypto';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createJwksVerifier } from '../../src/infra/token-verifier';

const ISSUER = 'http://localhost:54321/auth/v1';
const { publicKey, privateKey } = await generateKeyPair('ES256');
const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'ES256' };

export const testVerifier = createJwksVerifier({ getKey: createLocalJWKSet({ keys: [jwk] }), issuer: ISSUER });

type TokenOptions = { id: string; isAnonymous?: boolean; email?: string; name?: string; expiresIn?: string | number };

export async function tokenFor(opts: TokenOptions): Promise<string> {
  return new SignJWT({
    is_anonymous: opts.isAnonymous ?? false,
    email: opts.isAnonymous ? '' : (opts.email ?? 'teste@fincontrol.dev'),
    user_metadata: opts.name ? { full_name: opts.name } : {},
  })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setSubject(opts.id)
    .setIssuer(ISSUER)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? '1h')
    .sign(privateKey);
}

export async function newUser(opts: Omit<TokenOptions, 'id'> = {}) {
  const id = randomUUID();
  const token = await tokenFor({ id, ...opts });
  return { id, auth: { Authorization: `Bearer ${token}` } };
}

export type TestUser = Awaited<ReturnType<typeof newUser>>;
