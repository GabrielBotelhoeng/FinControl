import { describe, expect, it } from 'vitest';
import { AiError, createAnthropicClient } from './ai-client';

const logger = { error: () => undefined };
const req = { system: 's', tools: [], messages: [{ role: 'user' as const, content: 'oi' }], max_tokens: 10 };

function client(status: number, body: unknown) {
  const seen: { url: string; init: RequestInit }[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    seen.push({ url, init });
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { seen, ai: createAnthropicClient({ apiKey: 'sk-ant-teste', model: 'claude-haiku-4-5-20251001', fetchFn, logger }) };
}

const kindOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (err) {
    return err instanceof AiError ? err.kind : 'outro';
  }
};

describe('createAnthropicClient (A2, A11)', () => {
  it('manda a chave no cabeçalho, a versão da API e o modelo no corpo', async () => {
    const { seen, ai } = client(200, { content: [{ type: 'text', text: 'olá' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
    expect((await ai(req)).content).toEqual([{ type: 'text', text: 'olá' }]);
    const headers = seen[0]!.init.headers as Record<string, string>;
    expect(seen[0]!.url).toBe('https://api.anthropic.com/v1/messages');
    expect(headers['x-api-key']).toBe('sk-ant-teste');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(JSON.parse(seen[0]!.init.body as string)).toMatchObject({ model: 'claude-haiku-4-5-20251001', max_tokens: 10 });
  });

  it('separa crédito esgotado, sobrecarga e configuração', async () => {
    const error = (message: string) => ({ type: 'error', error: { type: 'x', message } });
    expect(await kindOf(client(400, error('Your credit balance is too low to access the Anthropic API.')).ai(req))).toBe('credit');
    expect(await kindOf(client(529, error('Overloaded')).ai(req))).toBe('busy');
    expect(await kindOf(client(429, error('rate limit')).ai(req))).toBe('busy');
    expect(await kindOf(client(500, 'falhou').ai(req))).toBe('busy');
    expect(await kindOf(client(401, error('invalid x-api-key')).ai(req))).toBe('config');
    expect(await kindOf(client(400, error('messages: bad')).ai(req))).toBe('config');
  });

  it('resposta 200 com corpo inválido é "ocupado", não erro interno', async () => {
    expect(await kindOf(client(200, '{"content": [').ai(req))).toBe('busy');
  });

  it('falha de rede é "ocupado"', async () => {
    const fetchFn = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    const ai = createAnthropicClient({ apiKey: 'sk-ant-x', model: 'm', fetchFn, logger });
    expect(await kindOf(ai(req))).toBe('busy');
  });
});
