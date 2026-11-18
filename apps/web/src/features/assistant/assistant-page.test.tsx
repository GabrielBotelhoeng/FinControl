import type { AssistantConfigDTO, AssistantMessage } from '@fincontrol/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api-client';
import { fakeApi, fakeGateway, signedIn } from '../../test/fakes';
import { renderApp } from '../../test/render';
import { recentHistory, validConversation } from './api';
import AssistantPage, { SUGGESTIONS } from './assistant-page';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const on: AssistantConfigDTO = { enabled: true, allowed: true, consented: true };

function api(config: AssistantConfigDTO, chat: (body: { messages: AssistantMessage[] }) => unknown = () => ({ reply: 'Você gastou R$ 120,00.' })) {
  let state = { ...config };
  return fakeApi({
    'GET /assistant/config': () => state,
    'POST /assistant/consent': () => {
      state = { ...state, consented: true };
    },
    'DELETE /assistant/consent': () => {
      state = { ...state, consented: false };
    },
    'POST /assistant/chat': (_p: string, b: unknown) => chat(b as { messages: AssistantMessage[] }),
  });
}

const render = (a: ReturnType<typeof api>, isAnonymous = false) =>
  renderApp(<AssistantPage />, { api: a, gateway: fakeGateway(signedIn(isAnonymous)).gateway, route: '/assistente' });

afterEach(() => sessionStorage.clear());

describe('AssistantPage', () => {
  it('A3: desligado no servidor, explica e não mostra a conversa', async () => {
    render(api({ enabled: false, allowed: false, consented: false }));
    expect(await screen.findByText('O assistente ainda não está ligado')).toBeInTheDocument();
    expect(screen.queryByLabelText('Sua pergunta')).not.toBeInTheDocument();
  });

  it('A3: na demo, convida a criar a conta', async () => {
    render(api({ enabled: true, allowed: false, consented: false }), true);
    expect(await screen.findByText('Na conta demo, o assistente fica desligado')).toBeInTheDocument();
  });

  it('A4: conta fora da lista vê que não está liberado', async () => {
    render(api({ enabled: true, allowed: false, consented: false }));
    expect(await screen.findByText('O assistente não está liberado para a sua conta')).toBeInTheDocument();
  });

  it('A5: mostra o que vai para a Anthropic e, ao aceitar, abre a conversa', async () => {
    const a = api({ ...on, consented: false });
    render(a);
    expect(await screen.findByText(/não usa esses dados para treinar/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Política de privacidade' })).toHaveAttribute('href', '/privacidade');
    await userEvent.click(screen.getByRole('button', { name: 'Aceitar e começar' }));
    expect(await screen.findByLabelText('Sua pergunta')).toBeInTheDocument();
    expect(a.post).toHaveBeenCalledWith('/assistant/consent');
  });

  it('A12: uma sugestão vira pergunta e a resposta aparece na conversa', async () => {
    const a = api(on);
    render(a);
    await userEvent.click(await screen.findByRole('button', { name: SUGGESTIONS[0] }));
    const chat = await screen.findByRole('list', { name: 'Conversa' });
    expect(await within(chat).findByText('Você gastou R$ 120,00.')).toBeInTheDocument();
    expect(within(chat).getByText(SUGGESTIONS[0]!)).toBeInTheDocument();
    expect(a.post).toHaveBeenCalledWith('/assistant/chat', { messages: [{ role: 'user', content: SUGGESTIONS[0] }] });
  });

  it('Enter envia; erro devolve a pergunta para a caixa e tira da conversa', async () => {
    const a = api(on, () => new ApiError(503, 'Créditos esgotados', 'Os créditos do assistente acabaram.'));
    render(a);
    const box = await screen.findByLabelText('Sua pergunta');
    await userEvent.type(box, 'Quanto gastei?{Enter}');
    await waitFor(() => expect(box).toHaveValue('Quanto gastei?'));
    expect(screen.queryByRole('list', { name: 'Conversa' })).not.toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith('Os créditos do assistente acabaram.');
  });

  it('A6: a conversa fica na aba e "Nova conversa" limpa', async () => {
    sessionStorage.setItem('fincontrol:assistente', JSON.stringify([{ role: 'user', content: 'oi' }, { role: 'assistant', content: 'Olá!' }]));
    render(api(on));
    expect(await screen.findByText('Olá!')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Nova conversa' }));
    expect(screen.queryByText('Olá!')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('fincontrol:assistente')).toBeNull();
    expect(screen.getByRole('list', { name: 'Sugestões' })).toBeInTheDocument();
  });

  it('retirar o consentimento pede confirmação, avisa e volta para a tela de aceite', async () => {
    render(api(on));
    await userEvent.click(await screen.findByRole('button', { name: 'Retirar consentimento' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Retirar' }));
    expect(await screen.findByRole('button', { name: 'Aceitar e começar' })).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('Consentimento retirado.');
  });

  it('409 na pergunta (consentimento retirado em outra aba) volta para a tela de aceite', async () => {
    let consented = true;
    const a = fakeApi({
      'GET /assistant/config': () => ({ ...on, consented }),
      'POST /assistant/chat': () => {
        consented = false;
        return new ApiError(409, 'Conflito', 'Aceite o envio dos dados ao assistente antes de perguntar.');
      },
    });
    render(a);
    await userEvent.click(await screen.findByRole('button', { name: SUGGESTIONS[1] }));
    expect(await screen.findByRole('button', { name: 'Aceitar e começar' })).toBeInTheDocument();
  });

  it('conversa salva fora do formato é descartada', async () => {
    sessionStorage.setItem('fincontrol:assistente', JSON.stringify([{ role: 'assistant', content: 'quebrado' }, { role: 'user', content: 'x' }]));
    render(api(on));
    expect(await screen.findByRole('list', { name: 'Sugestões' })).toBeInTheDocument();
    expect(screen.queryByText('quebrado')).not.toBeInTheDocument();
  });
});

describe('validConversation (A6)', () => {
  it('aceita pares, descarta pergunta sem resposta no fim e recusa formato errado', () => {
    const pair = [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }];
    expect(validConversation(pair)).toEqual(pair);
    expect(validConversation([...pair, { role: 'user', content: 'c' }])).toEqual(pair);
    expect(validConversation({})).toEqual([]);
    expect(validConversation([{ role: 'user', content: 1 }, { role: 'assistant', content: 'b' }])).toEqual([]);
  });
});

describe('recentHistory (A6)', () => {
  it('manda só as 7 últimas, começando pela pessoa, e corta resposta longa', () => {
    const all: AssistantMessage[] = Array.from({ length: 11 }, (_, i) => ({ role: i % 2 === 0 ? 'user' : 'assistant', content: i === 5 ? 'x'.repeat(1500) : `m${i}` }));
    const recent = recentHistory(all);
    expect(recent).toHaveLength(7);
    expect(recent[0]).toEqual({ role: 'user', content: 'm4' });
    expect(recent[1]!.content).toHaveLength(1000);
    expect(recent.at(-1)).toEqual({ role: 'user', content: 'm10' });
  });
});
