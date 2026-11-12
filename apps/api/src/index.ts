import type { Express } from 'express';
import { loadConfig } from './config/env';
import { createApp } from './http/app';
import { createSupabaseAuthAdmin } from './infra/auth-admin';
import { createLogger } from './infra/logger';
import { createPrisma } from './infra/prisma';
import { createSupabaseVerifier } from './infra/token-verifier';

// Raiz de composição. A Vercel usa o export default deste arquivo como a função da API.
export const config = loadConfig();
export const logger = createLogger(config.LOG_LEVEL);

const app: Express = createApp({
  config,
  logger,
  db: createPrisma(config.DATABASE_URL, config.DATABASE_CA_CERT),
  verifier: createSupabaseVerifier(config.SUPABASE_URL),
  authAdmin: createSupabaseAuthAdmin(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY),
  clock: () => new Date(),
});

export default app;
