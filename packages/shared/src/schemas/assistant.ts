import { z } from 'zod';

// ---------- Assistente com IA (spec 2026-11-18) ----------

export const ASSISTANT_MAX_MESSAGES = 8;
export const ASSISTANT_MAX_CHARS = 1000;

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1, 'Mensagem vazia').max(ASSISTANT_MAX_CHARS, `No máximo ${ASSISTANT_MAX_CHARS} caracteres`),
});

/** A6: o histórico vem do navegador; alterna papéis, começa e termina com a pessoa. */
export const assistantChatSchema = z.object({
  messages: z
    .array(messageSchema)
    .min(1, 'Envie uma pergunta')
    .max(ASSISTANT_MAX_MESSAGES, `No máximo ${ASSISTANT_MAX_MESSAGES} mensagens`)
    .refine((list) => list.every((m, i) => m.role === (i % 2 === 0 ? 'user' : 'assistant')), 'As mensagens devem alternar, começando pela sua')
    .refine((list) => list.at(-1)?.role === 'user', 'A última mensagem deve ser a sua pergunta'),
});

export type AssistantMessage = z.output<typeof messageSchema>;
export type AssistantChatInput = z.output<typeof assistantChatSchema>;

/** `enabled`: o servidor tem chave; `allowed`: esta conta pode usar (A3, A4); `consented`: aceitou o envio (A5). */
export type AssistantConfigDTO = { enabled: boolean; allowed: boolean; consented: boolean };
export type AssistantReplyDTO = { reply: string };
