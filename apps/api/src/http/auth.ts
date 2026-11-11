import type { RequestHandler, Response } from 'express';
import type { AuthClaims, TokenVerifier } from '../infra/token-verifier';
import { UnauthorizedError } from './errors';

export function requireAuth(verifier: TokenVerifier): RequestHandler {
  return async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedError();
    let claims: AuthClaims;
    try {
      claims = await verifier.verify(header.slice('Bearer '.length));
    } catch {
      throw new UnauthorizedError();
    }
    res.locals.auth = claims;
    next();
  };
}

export function authOf(res: Response): AuthClaims {
  const auth = res.locals.auth as AuthClaims | undefined;
  if (!auth) throw new UnauthorizedError();
  return auth;
}

export const userIdOf = (res: Response): string => authOf(res).userId;
