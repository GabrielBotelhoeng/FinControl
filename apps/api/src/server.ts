import { loadConfig } from './config/env';
import { createApp } from './http/app';
import { createSupabaseAuthAdmin } from './infra/auth-admin';
import { createLogger } from './infra/logger';
import { createPrisma } from './infra/prisma';
import { createSupabaseVerifier } from './infra/token-verifier';

const config = loadConfig();
const logger = createLogger(config.LOG_LEVEL);
const app = createApp({
  config,
  logger,
  db: createPrisma(config.DATABASE_URL),
  verifier: createSupabaseVerifier(config.SUPABASE_URL),
  authAdmin: createSupabaseAuthAdmin(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY),
  clock: () => new Date(),
});

app.listen(config.PORT, () => {
  logger.info(`API do FinControl ouvindo em http://localhost:${config.PORT}`);
});
