import { ASSISTANT_MAX_CHARS, ASSISTANT_MAX_MESSAGES, type AssistantConfigDTO, type AssistantMessage, type AssistantReplyDTO } from '@fincontrol/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../lib/api-context';

const KEY = ['assistant', 'config'];

export function useAssistantConfig() {
  const api = useApi();
  return useQuery({ queryKey: KEY, queryFn: () => api.get<AssistantConfigDTO>('/assistant/config') });
}

export function useConsent() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accept: boolean) => (accept ? api.post<void>('/assistant/consent') : api.del('/assistant/consent')),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

/**
 * A6: só as últimas mensagens vão para a API (número ímpar, para começar e terminar na pessoa), e uma resposta
 * longa do assistente é cortada no limite: o contexto e o custo não crescem com a conversa.
 */
export function recentHistory(all: AssistantMessage[]): AssistantMessage[] {
  const keep = ASSISTANT_MAX_MESSAGES % 2 === 0 ? ASSISTANT_MAX_MESSAGES - 1 : ASSISTANT_MAX_MESSAGES;
  return all.slice(-keep).map((m) => ({ role: m.role, content: m.content.slice(0, ASSISTANT_MAX_CHARS) }));
}

export function useAsk() {
  const api = useApi();
  return useMutation({
    mutationFn: (all: AssistantMessage[]) => api.post<AssistantReplyDTO>('/assistant/chat', { messages: recentHistory(all) }),
  });
}
