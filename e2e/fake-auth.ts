/**
 * Provedor de identidade falso para os testes E2E.
 *
 * Implementa só a fatia da API do Supabase Auth (GoTrue) que o app usa: cadastro (com e-mail ou anônimo),
 * login por senha, refresh, /user, logout, JWKS e exclusão pelo admin. Os tokens são JWTs ES256 de verdade,
 * então a API valida pelo mesmo caminho de produção (JWKS + issuer + audience). Todo o resto do E2E é real:
 * navegador, web buildada, API e Postgres.
 */
import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { exportJWK, generateKeyPair, jwtVerify, SignJWT, createLocalJWKSet, type JWK } from 'jose';

const PORT = Number(process.env.FAKE_AUTH_PORT ?? 54399);
const BASE = `http://localhost:${PORT}`;
const ISSUER = `${BASE}/auth/v1`;
const KID = 'e2e-key';

type User = {
  id: string;
  email: string | null;
  password: string | null;
  isAnonymous: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
};

const users = new Map<string, User>();
const refreshTokens = new Map<string, string>();

const { privateKey, publicKey } = await generateKeyPair('ES256');
const publicJwk: JWK = { ...(await exportJWK(publicKey)), kid: KID, alg: 'ES256', use: 'sig' };
const jwks = createLocalJWKSet({ keys: [publicJwk] });

function userJson(u: User) {
  return {
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email ?? '',
    phone: '',
    is_anonymous: u.isAnonymous,
    user_metadata: u.metadata,
    app_metadata: { provider: u.isAnonymous ? 'anonymous' : 'email', providers: u.isAnonymous ? [] : ['email'] },
    identities: [],
    created_at: u.createdAt,
    updated_at: u.createdAt,
  };
}

async function session(u: User) {
  const accessToken = await new SignJWT({
    email: u.email ?? '',
    role: 'authenticated',
    is_anonymous: u.isAnonymous,
    user_metadata: u.metadata,
    app_metadata: {},
    session_id: randomUUID(),
  })
    .setProtectedHeader({ alg: 'ES256', kid: KID, typ: 'JWT' })
    .setSubject(u.id)
    .setIssuer(ISSUER)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);
  const refresh = randomUUID();
  refreshTokens.set(refresh, u.id);
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: refresh,
    user: userJson(u),
  };
}

function send(res: ServerResponse, status: number, body?: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

const authError = (res: ServerResponse, status: number, code: string, msg: string) => send(res, status, { code, error_code: code, msg });

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

async function bearerUser(req: IncomingMessage): Promise<User | null> {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: ISSUER });
    return users.get(payload.sub ?? '') ?? null;
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] ?? '*');
  if (req.method === 'OPTIONS') return send(res, 204);

  const url = new URL(req.url ?? '/', BASE);
  const route = `${req.method} ${url.pathname.replace(/^\/auth\/v1/, '')}`;

  try {
    if (route === 'GET /health') return send(res, 200, { ok: true });
    if (route === 'GET /.well-known/jwks.json') return send(res, 200, { keys: [publicJwk] });

    if (route === 'POST /signup') {
      const body = await readBody(req);
      const email = typeof body.email === 'string' ? body.email.toLowerCase() : null;
      if (email && [...users.values()].some((u) => u.email === email)) {
        return authError(res, 422, 'user_already_exists', 'User already registered');
      }
      const user: User = {
        id: randomUUID(),
        email,
        password: typeof body.password === 'string' ? body.password : null,
        isAnonymous: email === null,
        metadata: (body.data as Record<string, unknown> | undefined) ?? {},
        createdAt: new Date().toISOString(),
      };
      users.set(user.id, user);
      return send(res, 200, await session(user));
    }

    if (route === 'POST /token') {
      const body = await readBody(req);
      const grant = url.searchParams.get('grant_type');
      if (grant === 'password') {
        const user = [...users.values()].find((u) => u.email === String(body.email).toLowerCase() && u.password === body.password);
        return user ? send(res, 200, await session(user)) : authError(res, 400, 'invalid_credentials', 'Invalid login credentials');
      }
      if (grant === 'refresh_token') {
        const user = users.get(refreshTokens.get(String(body.refresh_token)) ?? '');
        return user ? send(res, 200, await session(user)) : authError(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token');
      }
      return authError(res, 400, 'unsupported_grant_type', 'Unsupported grant type');
    }

    if (route === 'GET /user') {
      const user = await bearerUser(req);
      return user ? send(res, 200, userJson(user)) : authError(res, 401, 'bad_jwt', 'invalid JWT');
    }

    if (route === 'POST /logout') return send(res, 204);
    if (route === 'POST /recover') return send(res, 200, {});

    // O supabase-js busca o usuário (GET) antes de excluir (DELETE).
    const adminGet = /^GET \/admin\/users\/([\w-]+)$/.exec(route);
    if (adminGet) {
      const user = users.get(adminGet[1] ?? '');
      return user ? send(res, 200, userJson(user)) : authError(res, 404, 'user_not_found', 'User not found');
    }

    const adminDelete = /^DELETE \/admin\/users\/([\w-]+)$/.exec(route);
    if (adminDelete) {
      const id = adminDelete[1] ?? '';
      if (!users.delete(id)) return authError(res, 404, 'user_not_found', 'User not found');
      return send(res, 200, {});
    }

    return authError(res, 404, 'not_found', `Rota não implementada no fake: ${route}`);
  } catch (error) {
    console.error('[fake-auth]', error);
    return authError(res, 500, 'unexpected_failure', 'Erro no fake de auth');
  }
});

server.listen(PORT, () => console.log(`[fake-auth] ouvindo em ${BASE}`));
