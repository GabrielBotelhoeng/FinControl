import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../test/render';
import TermsPage from './terms-page';

describe('TermsPage', () => {
  it('define idade mínima de 18 anos, o que o app é e não é, e remete à privacidade', async () => {
    renderApp(<TermsPage />, { route: '/termos', path: '/termos' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Termos de Uso' })).toBeInTheDocument();
    for (const section of ['Quem pode usar', 'O que o FinControl é e o que não é', 'Modo demonstração', 'Regras de uso', 'Lei e foro']) {
      expect(screen.getByRole('heading', { level: 2, name: section })).toBeInTheDocument();
    }
    expect(screen.getByRole('heading', { level: 2, name: 'Quem pode usar' }).closest('section')).toHaveTextContent(/maiores de 18 anos/);
    expect(screen.getByText(/não é uma instituição financeira/)).toBeInTheDocument();
    expect(screen.getByText(/não é recomendação de investimento/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Política de Privacidade' })).toHaveAttribute('href', '/privacidade');
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute('href', '/entrar');
  });
});
