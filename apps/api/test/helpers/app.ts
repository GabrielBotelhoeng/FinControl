import { loadConfig } from '../../src/config/env';
import { createApp, type AppDeps } from '../../src/http/app';
import { createLogger } from '../../src/infra/logger';

export function buildTestApp(overrides: Partial<AppDeps> = {}) {
  const deps: AppDeps = { config: loadConfig(), logger: createLogger('silent'), ...overrides };
  return { app: createApp(deps), deps };
}
