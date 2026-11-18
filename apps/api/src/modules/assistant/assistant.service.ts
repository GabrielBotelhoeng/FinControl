import { todayInSaoPaulo, type AssistantConfigDTO, type AssistantMessage, type AssistantReplyDTO } from '@fincontrol/shared';
import { AppError, ConflictError, ForbiddenError } from '../../http/errors';
import { AiError, type AiBlock, type AiClient, type AiMessage, type AiToolResultBlock } from '../../infra/ai-client';
import type { Logger } from '../../infra/logger';
import type { AuthClaims } from '../../infra/token-verifier';
import type { CategoriesRepository } from '../categories/categories.repository';
import type { ProfileRepository } from '../profile/profile.repository';
import type { AssistantRepository } from './assistant.repository';
import { ToolInputError, type AssistantTools } from './assistant.tools';

export type AssistantServiceDeps = {
  /** `null` sem `ANTHROPIC_API_KEY` (A3): assistente desligado. */
  ai: AiClient | null;
  /** A4: e-mails liberados, em minúsculas; `*` libera toda conta real e a lista vazia não libera ninguém. */
  allowedEmails: string[];
  usage: AssistantRepository;
  tools: AssistantTools;
  profileRepo: Pick<ProfileRepository, 'find' | 'setAiConsent'>;
  categoriesRepo: Pick<CategoriesRepository, 'list'>;
  logger: Pick<Logger, 'info' | 'error'>;
  clock: () => Date;
};

/** A8: respostas curtas e no máximo 4 rodadas de ferramenta por pergunta. */
export const MAX_TOKENS = 700;
export const MAX_TOOL_ROUNDS = 4;
/** A9: tetos por dia (São Paulo), guardados no banco: valem entre instâncias da função. */
export const DAILY_LIMIT_PER_USER = 100;
export const DAILY_LIMIT_TOTAL = 400;
/** Prazo da pergunta inteira (todas as rodadas): passou disso, "ocupado" em vez de prender a função. */
export const DEADLINE_MS = 60_000;

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

function systemPrompt(name: string, today: string, expense: string[], income: string[]): string {
  const weekday = WEEKDAYS[new Date(`${today}T12:00:00Z`).getUTCDay()];
  return [
    'Você é o assistente do FinControl, um app de finanças pessoais. Ajude a pessoa a entender e controlar o próprio dinheiro.',
    `Hoje é ${today} (${weekday}). Você fala com ${name}.`,
    'Responda em português do Brasil simples, direto e curto (até 120 palavras, a menos que peçam detalhe).',
    'Texto puro: a tela não interpreta markdown. Nunca use **negrito**, asteriscos, # ou tabelas. Para listas, use linhas começando com "- ".',
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

/**
 * A12: a tela mostra texto puro. O modelo às vezes usa markdown mesmo pedindo que não use (visto em produção):
 * tira negrito, itálico, títulos e crases, e troca "* " e "• " por "- " no começo da linha.
 */
export function plainText(text: string): string {
  return text
    // Negrito pode quebrar linha, mas nunca atravessa um parágrafo (linha em branco).
    .replace(/\*\*((?:(?!\n\s*\n)(?!\*\*)[\s\S])+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    // Itálico sem espaço logo dentro dos asteriscos: "R$ 20 * 3" continua uma conta.
    // ...e só número entre asteriscos ("20 *3* 2") também é conta, não itálico.
    .replace(/(^|[\s(])\*([^*\s](?:[^*\n]*[^*\s])?)\*(?=[\s).,:;!?]|$)/gm, (m: string, before: string, inner: string) => (/^[\d.,]+$/.test(inner) ? m : before + inner))
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^([ \t]*)[*•][ \t]+/gm, '$1- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function createAssistantService(deps: AssistantServiceDeps) {
  async function access(claims: AuthClaims) {
    const profile = await deps.profileRepo.find(claims.userId);
    // O e-mail vem do token do Supabase, que exige confirmação no cadastro por e-mail (e o Google já confirma).
    const listed = deps.allowedEmails.includes('*') || (claims.email !== null && deps.allowedEmails.includes(claims.email.toLowerCase()));
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
        // Pedido fora das regras (ex.: mês além do planejamento) volta para o modelo corrigir, em vez de derrubar a pergunta.
        const forModel = err instanceof ToolInputError || (err instanceof AppError && err.status < 500);
        if (!forModel) throw err;
        results.push({ type: 'tool_result', tool_use_id: b.id, content: (err as Error).message, is_error: true });
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
      const today = todayInSaoPaulo(deps.clock());
      const used = await deps.usage.requestsOn(claims.userId, today);
      if (used.user >= DAILY_LIMIT_PER_USER) throw new AppError(429, 'Limite do dia', `Você chegou a ${DAILY_LIMIT_PER_USER} perguntas hoje. O assistente volta amanhã.`);
      if (used.total >= DAILY_LIMIT_TOTAL) throw new AppError(503, 'Limite do dia', 'O assistente atingiu o limite de uso de hoje. Ele volta amanhã.');

      const categories = await deps.categoriesRepo.list(claims.userId);
      const names = (type: string) => categories.filter((c) => c.type === type).map((c) => c.name);
      // Só o primeiro nome vai para a Anthropic (como dizem o aceite e a política de privacidade).
      const firstName = profile.name.trim().split(/\s+/)[0] || 'a pessoa';
      const system = systemPrompt(firstName, today, names('expense'), names('income'));
      const messages: AiMessage[] = history.map((m) => ({ role: m.role, content: m.content }));
      const usage = { input: 0, output: 0, rounds: 0 };
      const started = Date.now();
      let outcome = 'ok';

      try {
        for (;;) {
          // Na última rodada, `tool_choice: none`: o modelo tem de responder com o que já buscou. As ferramentas
          // continuam declaradas, porque a API recusa histórico com `tool_use` sem elas.
          if (Date.now() - started > DEADLINE_MS) throw new AiError('busy', 'Prazo da pergunta esgotado');
          const lastRound = usage.rounds >= MAX_TOOL_ROUNDS;
          const res = await ai({
            system, tools: deps.tools.definitions, messages, max_tokens: MAX_TOKENS, ...(lastRound ? { tool_choice: { type: 'none' } } : {}),
          });
          usage.input += res.usage.input_tokens;
          usage.output += res.usage.output_tokens;
          if (res.stop_reason !== 'tool_use' || lastRound) {
            const reply = plainText(textOf(res.content));
            return { reply: reply || 'Não consegui montar uma resposta agora. Pode perguntar de outro jeito?' };
          }
          usage.rounds += 1;
          messages.push({ role: 'assistant', content: res.content });
          messages.push({ role: 'user', content: await runTools(claims.userId, res.content) });
        }
      } catch (err) {
        outcome = err instanceof AiError ? err.kind : 'error';
        if (!(err instanceof AiError)) throw err;
        if (err.kind === 'credit') throw new AppError(503, 'Créditos esgotados', 'Os créditos do assistente acabaram. Recarregue o saldo na Anthropic para voltar a usar.');
        if (err.kind === 'busy') throw new AppError(503, 'Assistente ocupado', 'O assistente está ocupado. Tente de novo em instantes.');
        throw new AppError(503, 'Assistente indisponível', 'O assistente está com um problema de configuração.');
      } finally {
        // A8: acompanhar o gasto de créditos pelo log, sem o conteúdo da conversa.
        deps.logger.info({ userId: claims.userId, outcome, inputTokens: usage.input, outputTokens: usage.output, toolRounds: usage.rounds }, 'Assistente: pergunta');
        // Toda pergunta conta no limite, mesmo a que falhou: os tokens já gastos também.
        await deps.usage.record(claims.userId, today, usage.input, usage.output).catch((e: unknown) => deps.logger.error({ err: e }, 'Assistente: falha ao registrar o uso'));
      }
    },
  };
}

export type AssistantService = ReturnType<typeof createAssistantService>;
