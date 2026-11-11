import { loadConfig } from './config/env';
import { createApp } from './http/app';
import { createLogger } from './infra/logger';

const config = loadConfig();
const logger = createLogger(config.LOG_LEVEL);
const app = createApp({ config, logger });

app.listen(config.PORT, () => {
  logger.info(`API do FinControl ouvindo em http://localhost:${config.PORT}`);
});
