import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api-client';
import { fakeApi, fakeGateway, signedIn } from '../../test/fakes';
import { renderApp } from '../../test/render';
import ProfilePage from './profile-page';

const prefs = { bills: true, invoices: true, budget: true, goals: true, billDays: 3 };
const profile = { id: 'u1', name: 'Ana Lúcia', email: 'ana@exemplo.com', isDemo: false, theme: 'dark', notificationPrefs: prefs };

describe('ProfilePage', () => {
  it('trocar o tema aplica na hora e salva no perfil', async () => {
    const api = fakeApi({ 'GET /me': profile, 'PATCH /me': (_p: string, body: unknown) => ({ ...profile, ...(body as object) }) });
    renderApp(<ProfilePage />, { api });
    await userEvent.click(await screen.findByRole('radio', { name: 'Claro' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(api.patch).toHaveBeenCalledWith('/me', { theme: 'light' });
  });

  it('excluir conta exige digitar EXCLUIR, chama DELETE /me e sai', async () => {
    const { gateway } = fakeGateway(signedIn());
    const api = fakeApi({ 'GET /me': profile, 'DELETE /me': undefined });
    renderApp(<ProfilePage />, { api, gateway, extraRoutes: { '/entrar': <p>Entrada</p> } });
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir minha conta' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Excluir definitivamente' });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText('Digite EXCLUIR para confirmar'), 'EXCLUIR');
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    await waitFor(() => expect(api.del).toHaveBeenCalledWith('/me'));
    expect(gateway.signOut).toHaveBeenCalled();
  });

  it('tem o link "Ver relatórios" (no celular, os relatórios não estão na barra; R12)', async () => {
    renderApp(<ProfilePage />, { api: fakeApi({ 'GET /me': profile }) });
    expect(await screen.findByRole('link', { name: 'Ver relatórios' })).toHaveAttribute('href', '/relatorios');
  });

  it('tem o link "Gerenciar categorias" (a barra do celular não tem mais Categorias)', async () => {
    renderApp(<ProfilePage />, { api: fakeApi({ 'GET /me': profile }) });
    expect(await screen.findByRole('link', { name: 'Gerenciar categorias' })).toHaveAttribute('href', '/categorias');
  });

  it('preferências de notificação (N7): desligar um tipo e mudar a antecedência salvam o objeto inteiro', async () => {
    // Servidor falso com estado, como o real: a busca depois de salvar traz o que foi gravado.
    let saved = profile;
    const api = fakeApi({
      'GET /me': () => saved,
      'PATCH /me': (_p: string, body: unknown) => (saved = { ...saved, ...(body as object) }),
      'GET /notifications': { items: [], unreadCount: 0 },
    });
    renderApp(<ProfilePage />, { api });
    const panel = await screen.findByRole('region', { name: 'Notificações' });
    await userEvent.click(within(panel).getByRole('checkbox', { name: /Orçamento/ }));
    expect(api.patch).toHaveBeenLastCalledWith('/me', { notificationPrefs: { ...prefs, budget: false } });
    await userEvent.click(within(panel).getByRole('radio', { name: '7 dias' }));
    expect(api.patch).toHaveBeenLastCalledWith('/me', { notificationPrefs: { ...prefs, budget: false, billDays: 7 } });
  });

  it('a caixa muda na hora e volta se o salvamento falhar', async () => {
    const api = fakeApi({ 'GET /me': profile, 'PATCH /me': () => new ApiError(500, 'Erro', 'Falhou.') });
    renderApp(<ProfilePage />, { api });
    const box = within(await screen.findByRole('region', { name: 'Notificações' })).getByRole('checkbox', { name: /Metas/ });
    await userEvent.click(box);
    await waitFor(() => expect(box).toBeChecked());
  });
});
