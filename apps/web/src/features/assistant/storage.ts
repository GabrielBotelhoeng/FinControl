import type { AssistantMessage } from '@fincontrol/shared';

// A6: a conversa fica só nesta aba (`sessionStorage`), separada por conta e apagada ao sair.

const PREFIX = 'fincontrol:assistente:';

export const conversationKey = (userId: string) => `${PREFIX}${userId}`;

/** Conversa salva fora do formato (aba antiga, edição manual) é descartada em vez de travar as perguntas. */
export function validConversation(raw: unknown): AssistantMessage[] {
  if (!Array.isArray(raw)) return [];
  // Pares completos (pergunta e resposta), alternando e começando pela pessoa. Uma pergunta sem resposta no fim
  // (a aba recarregou enquanto esperava) é descartada.
  const list: unknown[] = raw.length % 2 === 0 ? raw : raw.slice(0, -1);
  const ok = list.every(
    (m: unknown, i) =>
      typeof m === 'object' && m !== null &&
      (m as AssistantMessage).role === (i % 2 === 0 ? 'user' : 'assistant') &&
      typeof (m as AssistantMessage).content === 'string' && (m as AssistantMessage).content.trim() !== '',
  );
  return ok ? (list as AssistantMessage[]) : [];
}

export function loadConversation(userId: string): AssistantMessage[] {
  try {
    const raw = sessionStorage.getItem(conversationKey(userId));
    return raw ? validConversation(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function saveConversation(userId: string, messages: AssistantMessage[]) {
  try {
    if (messages.length === 0) sessionStorage.removeItem(conversationKey(userId));
    else sessionStorage.setItem(conversationKey(userId), JSON.stringify(messages));
  } catch {
    // sem armazenamento (aba privada): a conversa vive só na memória
  }
}

/** Ao sair da conta: nenhuma conversa fica na aba para a próxima pessoa. */
export function forgetConversations() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(PREFIX)) sessionStorage.removeItem(key);
    }
  } catch {
    // sem armazenamento: nada a apagar
  }
}
