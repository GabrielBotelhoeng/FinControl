import { loadConfig } from '../../src/config/env';
import { createApp } from '../../src/http/app';
import type { AppDeps } from '../../src/http/deps';
import { createLogger } from '../../src/infra/logger';
import { testVerifier } from './auth';
import { testDb } from './db';
import { fakeAuthAdmin } from './fakes';

/** 11/11/2026 12:00 em São Paulo. Todo "hoje" dos testes é 2026-11-11. */
export const FIXED_NOW = new Date('2026-11-11T15:00:00Z');

export function buildTestApp(overrides: Partial<AppDeps> = {}) {
  const authAdmin = fakeAuthAdmin();
  const deps: AppDeps = {
    config: loadConfig(),
    logger: createLogger('silent'),
    db: testDb,
    verifier: testVerifier,
    authAdmin,
    clock: () => FIXED_NOW,
    ...overrides,
  };
  return { app: createApp(deps), deps, authAdmin };
}
