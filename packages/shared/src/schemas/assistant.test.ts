import { describe, expect, it } from 'vitest';
import { assistantChatSchema } from './index';

const user = (content: string) => ({ role: 'user' as const, content });
const bot = (content: string) => ({ role: 'assistant' as const, content });
const ok = (messages: unknown[]) => assistantChatSchema.safeParse({ messages }).success;

describe('assistantChatSchema (A6)', () => {
  it('aceita uma pergunta e uma conversa alternada que termina na pessoa', () => {
    expect(ok([user('Quanto gastei?')])).toBe(true);
    expect(ok([user('a'), bot('b'), user('c')])).toBe(true);
  });

  it('apara o texto', () => {
    expect(assistantChatSchema.parse({ messages: [user('  oi  ')] }).messages[0]!.content).toBe('oi');
  });

  it('recusa vazio, papel fora de ordem e conversa terminando no assistente', () => {
    expect(ok([])).toBe(false);
    expect(ok([user('   ')])).toBe(false);
    expect(ok([bot('a')])).toBe(false);
    expect(ok([user('a'), user('b')])).toBe(false);
    expect(ok([user('a'), bot('b')])).toBe(false);
  });

  it('limita a 8 mensagens e 1.000 caracteres', () => {
    const nine = Array.from({ length: 9 }, (_, i) => (i % 2 === 0 ? user('a') : bot('b')));
    expect(ok(nine)).toBe(false);
    expect(ok(nine.slice(0, 7))).toBe(true);
    expect(ok([user('x'.repeat(1001))])).toBe(false);
    expect(ok([user('x'.repeat(1000))])).toBe(true);
  });
});
