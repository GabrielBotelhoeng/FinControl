import type { AppConfig } from '../config/env';
import type { AuthAdmin } from '../infra/auth-admin';
import type { Logger } from '../infra/logger';
import type { Db } from '../infra/prisma';
import type { TokenVerifier } from '../infra/token-verifier';

export type AppDeps = {
  config: AppConfig;
  logger: Logger;
  db: Db;
  verifier: TokenVerifier;
  authAdmin: AuthAdmin;
  clock: () => Date;
};
