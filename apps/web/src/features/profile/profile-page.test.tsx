import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeApi, fakeGateway, signedIn } from '../../test/fakes';
import { renderApp } from '../../test/render';
import ProfilePage from './profile-page';

const profile = { id: 'u1', name: 'Ana Lúcia', email: 'ana@exemplo.com', isDemo: false, theme: 'dark' };

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
});
