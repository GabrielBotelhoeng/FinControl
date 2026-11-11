import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import type { Logger } from '../infra/logger';

const VALID_ID = /^[\w-]{1,64}$/;

export function requestLogger(logger: Logger) {
  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id = typeof incoming === 'string' && VALID_ID.test(incoming) ? incoming : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
  });
}
