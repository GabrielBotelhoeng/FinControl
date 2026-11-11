import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import type { Logger } from '../infra/logger';
import { AppError } from './errors';

function sendProblem(res: Response, status: number, title: string, detail: string, errors?: unknown) {
  res
    .status(status)
    .type('application/problem+json')
    .json({ type: 'about:blank', title, status, detail, ...(errors ? { errors } : {}) });
}

function bodyParserType(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string') return err.type;
  return undefined;
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  sendProblem(res, 404, 'Rota não encontrada', 'O endereço solicitado não existe.');
};

export const tooManyRequests: RequestHandler = (_req, res) => {
  sendProblem(res, 429, 'Muitas requisições', 'Aguarde um pouco e tente novamente.');
};

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, _next) => {
    if (err instanceof AppError) {
      sendProblem(res, err.status, err.title, err.message, err.errors);
      return;
    }
    const parserType = bodyParserType(err);
    if (parserType === 'entity.parse.failed') {
      sendProblem(res, 400, 'JSON inválido', 'O corpo da requisição não é um JSON válido.');
      return;
    }
    if (parserType === 'entity.too.large') {
      sendProblem(res, 413, 'Corpo muito grande', 'O corpo da requisição excede o limite.');
      return;
    }
    logger.error({ err, requestId: req.id }, 'erro inesperado');
    sendProblem(res, 500, 'Erro interno', 'Algo deu errado. Tente novamente.');
  };
}
