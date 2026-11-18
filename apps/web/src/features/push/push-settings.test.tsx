import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeApi } from '../../test/fakes';
import { renderApp } from '../../test/render';
import type { BrowserSubscription, PushClient } from './push-client';
import { PushSettings } from './push-settings';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const SUB: BrowserSubscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'p', auth: 'a' } };

function client(over: Partial<PushClient> = {}): PushClient {
  return {
    support: () => 'supported',
    permission: () => 'default',
    current: async () => null,
    subscribe: vi.fn(async () => SUB),
    unsubscribe: vi.fn(async () => SUB.endpoint),
    ...over,
  };
}

const api = (enabled = true) =>
  fakeApi({
    'GET /push/config': { enabled, publicKey: enabled ? 'BKey' : null },
    'POST /push/subscriptions': undefined,
    'POST /push/unsubscribe': undefined,
    'POST /push/test': { sent: 1 },
  });

const group = () => screen.findByRole('group', { name: 'Avisos no celular e no navegador' });

describe('PushSettings (W4)', () => {
  afterEach(() => vi.clearAllMocks());

  it('ativar pede a permissão pelo navegador e grava a assinatura na API', async () => {
    const c = client();
    const a = api();
    renderApp(<PushSettings isDemo={false} client={c} />, { api: a });
    await userEvent.click(await screen.findByRole('button', { name: 'Receber no celular e no navegador' }));
    expect(c.subscribe).toHaveBeenCalledWith('BKey');
    expect(a.post).toHaveBeenCalledWith('/push/subscriptions', SUB);
    expect(await screen.findByText('Ligado neste aparelho')).toBeInTheDocument();
  });

  it('ligado: manda o aviso de teste e desliga neste aparelho', async () => {
    const c = client({ permission: () => 'granted', current: async () => SUB });
    const a = api();
    renderApp(<PushSettings isDemo={false} client={c} />, { api: a });
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar um aviso de teste' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Aviso de teste enviado. Ele chega em alguns segundos.'));
    await userEvent.click(screen.getByRole('button', { name: 'Desligar neste aparelho' }));
    expect(a.post).toHaveBeenCalledWith('/push/unsubscribe', { endpoint: SUB.endpoint });
    expect(await screen.findByRole('button', { name: 'Receber no celular e no navegador' })).toBeInTheDocument();
  });

  it('permissão negada mostra o erro e continua desligado', async () => {
    const c = client({ subscribe: vi.fn(async () => Promise.reject(new Error('Sem permissão para mostrar avisos neste navegador.'))) });
    const a = api();
    renderApp(<PushSettings isDemo={false} client={c} />, { api: a });
    await userEvent.click(await screen.findByRole('button', { name: 'Receber no celular e no navegador' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Sem permissão para mostrar avisos neste navegador.'));
    expect(a.post).not.toHaveBeenCalledWith('/push/subscriptions', expect.anything());
  });

  it.each([
    ['servidor sem chaves', { enabled: false }, client(), 'ainda não estão disponíveis'],
    ['conta demo', { isDemo: true }, client(), 'conta de verdade'],
    ['iPhone sem instalar', {}, client({ support: () => 'ios-needs-install' }), 'Adicionar à Tela de Início'],
    ['navegador sem suporte', {}, client({ support: () => 'unsupported' }), 'Este navegador não recebe avisos'],
    ['bloqueado', {}, client({ permission: () => 'denied' }), 'bloqueados neste navegador'],
  ])('%s: explica e não mostra o botão', async (_name, opts, c, text) => {
    const o = opts as { enabled?: boolean; isDemo?: boolean };
    renderApp(<PushSettings isDemo={o.isDemo ?? false} client={c} />, { api: api(o.enabled ?? true) });
    const box = await group();
    await waitFor(() => expect(box).toHaveTextContent(text));
    expect(screen.queryByRole('button', { name: 'Receber no celular e no navegador' })).not.toBeInTheDocument();
  });
});
