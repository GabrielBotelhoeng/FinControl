import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../test/render';
import PrivacyPage from './privacy-page';

describe('PrivacyPage', () => {
  it('explica dados coletados, exclusão da conta, direitos e contato', async () => {
    renderApp(<PrivacyPage />, { route: '/privacidade', path: '/privacidade' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Política de Privacidade' })).toBeInTheDocument();
    for (const section of ['Quais dados coletamos', 'Como usamos os dados', 'Com quem compartilhamos', 'Por quanto tempo guardamos', 'Seus direitos']) {
      expect(screen.getByRole('heading', { level: 2, name: section })).toBeInTheDocument();
    }
    expect(screen.getByText(/Excluir minha conta/)).toBeInTheDocument();
    for (const link of screen.getAllByRole('link', { name: 'botelhog45@gmail.com' })) {
      expect(link).toHaveAttribute('href', 'mailto:botelhog45@gmail.com');
    }
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute('href', '/entrar');
  });

  it('informa a base legal de cada finalidade (LGPD art. 7º)', async () => {
    renderApp(<PrivacyPage />, { route: '/privacidade', path: '/privacidade' });
    expect(await screen.findByText(/execução do serviço que você solicitou \(art\. 7º, V/)).toBeInTheDocument();
    expect(screen.getByText(/legítimo interesse \(art\. 7º, IX/)).toBeInTheDocument();
  });
});
