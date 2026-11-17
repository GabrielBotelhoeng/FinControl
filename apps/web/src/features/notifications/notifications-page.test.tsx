import type { NotificationDTO, NotificationListDTO } from '@fincontrol/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeApi } from '../../test/fakes';
import { renderApp } from '../../test/render';
import { NotificationBell } from './bell';
import NotificationsPage from './notifications-page';

const note = (over: Partial<NotificationDTO>): NotificationDTO => ({
  key: 'k', kind: 'bill_due', priority: 2, title: 'Aluguel', body: 'R$ 1.800,00 · vence em 2 dias', href: '/lancamentos', action: 'Pagar', date: '2026-11-13', read: false, ...over,
});

const items = [
  note({ key: 'overdue:1', kind: 'bill_overdue', priority: 1, title: 'Internet', body: 'R$ 120,00 · venceu há 6 dias' }),
  note({ key: 'due:2' }),
  note({ key: 'goal:3', kind: 'goal_reached', priority: 4, title: 'Meta concluída: Viagem', href: '/planejamento?aba=metas', action: 'Ver metas', read: true }),
];

/** A API falsa guarda o estado de lido, como a real. */
function api(initial = items) {
  let state = initial.map((i) => ({ ...i }));
  const body = (): NotificationListDTO => ({ items: state, unreadCount: state.filter((i) => !i.read).length });
  return fakeApi({
    'GET /notifications': () => body(),
    'POST /notifications/read-all': () => {
      state = state.map((i) => ({ ...i, read: true }));
      return body();
    },
    'POST /notifications/read': (_p: string, b: unknown) => {
      const keys = (b as { keys: string[] }).keys;
      state = state.map((i) => (keys.includes(i.key) ? { ...i, read: true } : i));
      return body();
    },
  });
}

describe('NotificationBell (N9)', () => {
  it('mostra os não lidos no rótulo e no selo, e leva para /notificacoes', async () => {
    renderApp(<NotificationBell />, { api: api() });
    const bell = await screen.findByRole('link', { name: 'Notificações, 2 não lidas' });
    expect(bell).toHaveAttribute('href', '/notificacoes');
    expect(bell).toHaveTextContent('2');
  });

  it('acima de 9 mostra "9+"; sem não lidos, sem selo', async () => {
    const many = Array.from({ length: 12 }, (_, i) => note({ key: `k${i}` }));
    const { unmount } = renderApp(<NotificationBell />, { api: api(many) });
    expect(await screen.findByRole('link', { name: 'Notificações, 12 não lidas' })).toHaveTextContent('9+');
    unmount();
    renderApp(<NotificationBell />, { api: api([]) });
    expect(await screen.findByRole('link', { name: 'Notificações' })).toHaveTextContent('');
  });
});

describe('NotificationsPage', () => {
  it('lista na ordem da API, com o tipo escrito e a marca de não lida', async () => {
    renderApp(<NotificationsPage />, { api: api() });
    const list = await screen.findByRole('list', { name: 'Notificações' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual(['Internet', 'Aluguel', 'Meta concluída: Viagem']);
    expect(rows[0]).toHaveTextContent(/Conta vencida · não lida.*venceu há 6 dias/);
    expect(rows[2]).not.toHaveTextContent('não lida');
    expect(within(rows[2]!).getByRole('link', { name: 'Ver metas' })).toHaveAttribute('href', '/planejamento?aba=metas');
  });

  it('critério 4: clicar na ação marca como lida e o contador cai; "marcar todas" zera', async () => {
    const client = api();
    renderApp(
      <>
        <NotificationBell />
        <NotificationsPage />
      </>,
      { api: client },
    );
    const list = await screen.findByRole('list', { name: 'Notificações' });
    await userEvent.click(within(list).getAllByRole('link', { name: 'Pagar' })[0]!);
    expect(client.post).toHaveBeenCalledWith('/notifications/read', { keys: ['overdue:1'] });
    expect(await screen.findByRole('link', { name: 'Notificações, 1 não lida' })).toBeInTheDocument();
  });

  it('"Marcar todas como lidas" zera o contador e some o botão', async () => {
    const client = api();
    renderApp(
      <>
        <NotificationBell />
        <NotificationsPage />
      </>,
      { api: client },
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar todas como lidas' }));
    expect(await screen.findByRole('link', { name: 'Notificações' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Marcar todas como lidas' })).not.toBeInTheDocument());
  });

  it('estado vazio "Tudo em dia" com o link para o Perfil', async () => {
    renderApp(<NotificationsPage />, { api: api([]) });
    expect(await screen.findByText('Tudo em dia')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ajustar notificações' })).toHaveAttribute('href', '/perfil');
  });
});
