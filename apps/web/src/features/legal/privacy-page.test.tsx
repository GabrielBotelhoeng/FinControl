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
    // Cada base precisa estar no item da sua finalidade, não só em algum lugar da página.
    const account = (await screen.findByText(/Conta, finanças e demonstração:/)).closest('li');
    const security = screen.getByText(/Segurança:/).closest('li');
    expect(account).toHaveTextContent(/execução do serviço que você solicitou \(art\. 7º, V\)/);
    expect(security).toHaveTextContent(/legítimo interesse \(art\. 7º, IX\)/);
    expect(account).not.toHaveTextContent(/legítimo interesse/);
  });

  it('diz que o app é para maiores de 18 e onde cada provedor processa os dados', async () => {
    renderApp(<PrivacyPage />, { route: '/privacidade', path: '/privacidade' });
    expect(await screen.findByText(/destinado a maiores de 18 anos/)).toBeInTheDocument();
    const vercel = screen.getByText(/^Vercel:/).closest('li');
    expect(vercel).toHaveTextContent(/São Paulo/);
    expect(vercel).toHaveTextContent(/Estados Unidos/);
    expect(screen.getByRole('link', { name: 'Termos de Uso' })).toHaveAttribute('href', '/termos');
  });
});
