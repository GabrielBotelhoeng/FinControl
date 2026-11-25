import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetUpdateStateForTests, watchForUpdates } from '../lib/pwa-update';
import { UpdateNotice } from './update-notice';

// O sonner prende o ponteiro ao tocar no aviso (para o gesto de arrastar); o jsdom não tem essas funções.
HTMLElement.prototype.setPointerCapture ??= () => {};
HTMLElement.prototype.releasePointerCapture ??= () => {};

/** Um formulário aberto, o aviso e o Toaster, como no app. */
function renderWithForm(reload = vi.fn()) {
  render(
    <>
      <label>
        Descrição
        <input defaultValue="" />
      </label>
      <UpdateNotice reload={reload} />
      <Toaster containerAriaLabel="Avisos" />
    </>,
  );
  return reload;
}

const preloadError = () => act(() => void window.dispatchEvent(new Event('vite:preloadError')));

describe('UpdateNotice', () => {
  let stop: () => void;
  beforeEach(() => {
    resetUpdateStateForTests();
    stop = watchForUpdates({ container: undefined });
  });
  afterEach(() => stop());

  it('sem versão nova, não mostra nada', () => {
    renderWithForm();
    expect(screen.queryByText('Nova versão disponível')).not.toBeInTheDocument();
  });

  it('com versão nova, mostra o aviso como status, com Atualizar, sem roubar o foco do formulário', async () => {
    const user = userEvent.setup();
    renderWithForm();
    const field = screen.getByLabelText('Descrição');
    await user.type(field, 'Mercado');
    preloadError();
    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('Nova versão disponível');
    expect(screen.getByRole('button', { name: 'Atualizar' })).toBeInTheDocument();
    // O cursor continua no campo, com o que foi digitado.
    expect(field).toHaveFocus();
    expect(field).toHaveValue('Mercado');
  });

  it('Atualizar recarrega a página', async () => {
    const user = userEvent.setup();
    const reload = renderWithForm();
    preloadError();
    await user.click(await screen.findByRole('button', { name: 'Atualizar' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('não recarrega sozinho', async () => {
    const reload = renderWithForm();
    preloadError();
    await screen.findByText('Nova versão disponível');
    expect(reload).not.toHaveBeenCalled();
  });

  it('vários sinais mostram um aviso só', async () => {
    renderWithForm();
    preloadError();
    preloadError();
    await screen.findByText('Nova versão disponível');
    expect(screen.getAllByText('Nova versão disponível')).toHaveLength(1);
  });

  it('dá para fechar o aviso', async () => {
    const user = userEvent.setup();
    renderWithForm();
    preloadError();
    await user.click(await screen.findByRole('button', { name: 'Fechar aviso' }));
    await waitFor(() => expect(screen.queryByText('Nova versão disponível')).not.toBeInTheDocument());
  });

  it('a região dos avisos tem nome em português', () => {
    renderWithForm();
    expect(document.querySelector('section[aria-label^="Avisos"]')).not.toBeNull();
  });
});
