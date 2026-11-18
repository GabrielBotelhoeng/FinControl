import { todayInSaoPaulo, type AssistantConfigDTO, type AssistantMessage, type AssistantReplyDTO } from '@fincontrol/shared';
import { AppError, ConflictError, ForbiddenError } from '../../http/errors';
import { AiError, type AiBlock, type AiClient, type AiMessage, type AiToolResultBlock } from '../../infra/ai-client';
import type { Logger } from '../../infra/logger';
import type { AuthClaims } from '../../infra/token-verifier';
import type { CategoriesRepository } from '../categories/categories.repository';
import type { ProfileRepository } from '../profile/profile.repository';
import { ToolInputError, type AssistantTools } from './assistant.tools';

export type AssistantServiceDeps = {
  /** `null` sem `ANTHROPIC_API_KEY` (A3): assistente desligado. */
  ai: AiClient | null;
  /** A4: vazio = toda conta real pode usar. Já em minúsculas. */
  allowedEmails: string[];
  tools: AssistantTools;
  profileRepo: Pick<ProfileRepository, 'find' | 'setAiConsent'>;
  categoriesRepo: Pick<CategoriesRepository, 'list'>;
  logger: Pick<Logger, 'info' | 'error'>;
  clock: () => Date;
};

/** A8: respostas curtas e no máximo 4 rodadas de ferramenta por pergunta. */
export const MAX_TOKENS = 700;
export const MAX_TOOL_ROUNDS = 4;

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

function systemPrompt(name: string, today: string, expense: string[], income: string[]): string {
  const weekday = WEEKDAYS[new Date(`${today}T12:00:00Z`).getUTCDay()];
  return [
    'Você é o assistente do FinControl, um app de finanças pessoais. Ajude a pessoa a entender e controlar o próprio dinheiro.',
    `Hoje é ${today} (${weekday}). Você fala com ${name}.`,
    'Responda em português do Brasil simples, direto e curto (até 120 palavras, a menos que peçam detalhe).',
    'Texto puro: sem markdown, sem asteriscos, sem # e sem tabelas. Para listas, use linhas começando com "- ".',
    'Valores no formato R$ 1.234,56. Os números das ferramentas estão em reais.',
    'Use as ferramentas para buscar os números e nunca invente valores. Se não houver dados, diga isso.',
    'Você só consulta: não cria, edita nem apaga nada. Se pedirem um lançamento, explique onde fazer no app.',
    'Pode sugerir onde cortar gastos e como organizar o orçamento, mas não recomende investimentos ou produtos financeiros específicos.',
    `Categorias de despesa: ${expense.join(', ') || 'nenhuma'}.`,
    `Categorias de receita: ${income.join(', ') || 'nenhuma'}.`,
  ].join('\n');
}

const textOf = (blocks: AiBlock[]) =>
  blocks.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n').trim();

export function createAssistantService(deps: AssistantServiceDeps) {
  async function access(claims: AuthClaims) {
    const profile = await deps.profileRepo.find(claims.userId);
    const listed = deps.allowedEmails.length === 0 || (claims.email !== null && deps.allowedEmails.includes(claims.email.toLowerCase()));
    // A3: a demo é pública e nunca usa os créditos.
    const allowed = Boolean(profile && !profile.isDemo && !claims.isAnonymous && listed);
    return { profile, allowed, consented: Boolean(profile?.aiConsentAt) };
  }

  async function guard(claims: AuthClaims) {
    if (!deps.ai) throw new AppError(503, 'Assistente indisponível', 'O assistente não está configurado neste servidor.');
    const a = await access(claims);
    if (!a.allowed || !a.profile) throw new ForbiddenError('O assistente não está liberado para esta conta.');
    return { ai: deps.ai, profile: a.profile, consented: a.consented };
  }

  async function runTools(userId: string, blocks: AiBlock[]): Promise<AiToolResultBlock[]> {
    const results: AiToolResultBlock[] = [];
    for (const b of blocks) {
      if (b.type !== 'tool_use') continue;
      try {
        results.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(await deps.tools.run(userId, b.name, b.input)) });
      } catch (err) {
        if (!(err instanceof ToolInputError)) throw err;
        results.push({ type: 'tool_result', tool_use_id: b.id, content: err.message, is_error: true });
      }
    }
    return results;
  }

  return {
    async config(claims: AuthClaims): Promise<AssistantConfigDTO> {
      const a = await access(claims);
      return { enabled: deps.ai !== null, allowed: a.allowed, consented: a.consented };
    },

    async consent(claims: AuthClaims): Promise<void> {
      await guard(claims);
      await deps.profileRepo.setAiConsent(claims.userId, deps.clock());
    },

    /** Retirar o consentimento vale sempre, mesmo com o assistente desligado. */
    async revokeConsent(userId: string): Promise<void> {
      await deps.profileRepo.setAiConsent(userId, null);
    },

    async chat(claims: AuthClaims, history: AssistantMessage[]): Promise<AssistantReplyDTO> {
      const { ai, profile, consented } = await guard(claims);
      if (!consented) throw new ConflictError('Aceite o envio dos dados ao assistente antes de perguntar.');

      const categories = await deps.categoriesRepo.list(claims.userId);
      const names = (type: string) => categories.filter((c) => c.type === type).map((c) => c.name);
      const system = systemPrompt(profile.name, todayInSaoPaulo(deps.clock()), names('expense'), names('income'));
      const messages: AiMessage[] = history.map((m) => ({ role: m.role, content: m.content }));
      const usage = { input: 0, output: 0, rounds: 0 };

      try {
        for (;;) {
          // Na última rodada, `tool_choice: none`: o modelo tem de responder com o que já buscou. As ferramentas
          // continuam declaradas, porque a API recusa histórico com `tool_use` sem elas.
          const lastRound = usage.rounds >= MAX_TOOL_ROUNDS;
          const res = await ai({
            system, tools: deps.tools.definitions, messages, max_tokens: MAX_TOKENS, ...(lastRound ? { tool_choice: { type: 'none' } } : {}),
          });
          usage.input += res.usage.input_tokens;
          usage.output += res.usage.output_tokens;
          if (res.stop_reason !== 'tool_use' || lastRound) {
            const reply = textOf(res.content);
            return { reply: reply || 'Não consegui montar uma resposta agora. Pode perguntar de outro jeito?' };
          }
          usage.rounds += 1;
          messages.push({ role: 'assistant', content: res.content });
          messages.push({ role: 'user', content: await runTools(claims.userId, res.content) });
        }
      } catch (err) {
        if (!(err instanceof AiError)) throw err;
        if (err.kind === 'credit') throw new AppError(503, 'Créditos esgotados', 'Os créditos do assistente acabaram. Recarregue o saldo na Anthropic para voltar a usar.');
        if (err.kind === 'busy') throw new AppError(503, 'Assistente ocupado', 'O assistente está ocupado. Tente de novo em instantes.');
        throw new AppError(503, 'Assistente indisponível', 'O assistente está com um problema de configuração.');
      } finally {
        // A8: acompanhar o gasto de créditos pelo log, sem o conteúdo da conversa.
        deps.logger.info({ userId: claims.userId, inputTokens: usage.input, outputTokens: usage.output, toolRounds: usage.rounds }, 'Assistente: pergunta respondida');
      }
    },
  };
}

export type AssistantService = ReturnType<typeof createAssistantService>;
