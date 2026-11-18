import type { Logger } from './logger';

// Messages API da Anthropic por `fetch` (spec do assistente, A2): só os campos que o assistente usa.

export type AiTextBlock = { type: 'text'; text: string };
export type AiToolUseBlock = { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
export type AiToolResultBlock = { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };
export type AiBlock = AiTextBlock | AiToolUseBlock | AiToolResultBlock;
export type AiMessage = { role: 'user' | 'assistant'; content: string | AiBlock[] };
export type AiTool = { name: string; description: string; input_schema: Record<string, unknown> };

export type AiRequest = { system: string; tools: AiTool[]; messages: AiMessage[]; max_tokens: number; tool_choice?: { type: 'auto' | 'none' } };
export type AiResponse = {
  content: AiBlock[];
  stop_reason: string | null;
  usage: { input_tokens: number; output_tokens: number };
};
export type AiClient = (req: AiRequest) => Promise<AiResponse>;

/** A11: `credit` = créditos acabaram; `busy` = sobrecarga, limite ou rede; `config` = chave ou pedido inválido. */
export class AiError extends Error {
  readonly kind: 'credit' | 'busy' | 'config';
  constructor(kind: 'credit' | 'busy' | 'config', message: string) {
    super(message);
    this.name = 'AiError';
    this.kind = kind;
  }
}

const URL = 'https://api.anthropic.com/v1/messages';
const TIMEOUT_MS = 45_000;

export function createAnthropicClient(opts: { apiKey: string; model: string; fetchFn?: typeof fetch; logger: Pick<Logger, 'error'> }): AiClient {
  const fetchFn = opts.fetchFn ?? fetch;
  return async (req) => {
    let res: Response;
    try {
      res = await fetchFn(URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': opts.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: opts.model, ...req }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new AiError('busy', `Falha de rede: ${(err as Error).message}`);
    }
    if (res.ok) return (await res.json()) as AiResponse;

    const text = await res.text().catch(() => '');
    let message = text.slice(0, 300);
    try {
      message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? message;
    } catch {
      // corpo não é JSON: fica o texto cortado
    }
    // A chave nunca entra no log; só o status e a mensagem da Anthropic.
    opts.logger.error({ status: res.status, message }, 'Assistente: a Anthropic recusou o pedido');
    if (res.status === 400 && /credit balance/i.test(message)) throw new AiError('credit', message);
    if (res.status === 429 || res.status === 529 || res.status >= 500) throw new AiError('busy', message);
    throw new AiError('config', message);
  };
}
