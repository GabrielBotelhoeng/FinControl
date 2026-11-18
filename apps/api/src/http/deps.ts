import type { AppConfig } from '../config/env';
import type { AiClient } from '../infra/ai-client';
import type { AuthAdmin } from '../infra/auth-admin';
import type { Logger } from '../infra/logger';
import type { Db } from '../infra/prisma';
import type { PushSender } from '../infra/push-sender';
import type { TokenVerifier } from '../infra/token-verifier';

export type AppDeps = {
  config: AppConfig;
  logger: Logger;
  db: Db;
  verifier: TokenVerifier;
  authAdmin: AuthAdmin;
  clock: () => Date;
  /** `fetch` do cliente do Banco Central; injetado nos testes para não usar rede. */
  fetchFn?: typeof fetch;
  /** Envio de Web Push; nos testes, um falso. Sem ele, o container usa o `web-push` com as chaves VAPID. */
  pushSender?: PushSender;
  /** Cliente da Anthropic; nos testes, um falso. Sem ele, o container usa a Messages API com `ANTHROPIC_API_KEY`. */
  aiClient?: AiClient;
};
