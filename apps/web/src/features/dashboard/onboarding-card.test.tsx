import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api-client';
import { fakeApi, fakeGateway, signedIn } from '../../test/fakes';
import { renderApp } from '../../test/render';
import { OnboardingCard } from './onboarding-card';

const steps = (over: Record<string, boolean> = {}) => ({ account: true, transaction: false, budget: false, goal: false, ...over });
const card = () => screen.findByRole('region', { name: 'Primeiros passos' });
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

describe('OnboardingCard (sub-projeto 12)', () => {
  beforeEach(() => localStorage.clear());

  it('mostra o progresso, o passo feito e os links dos que faltam (G1, G4, G5)', async () => {
    renderApp(<OnboardingCard />, { api: fakeApi({ 'GET /onboarding': steps() }) });
    const region = await card();
    expect(region).toHaveTextContent('1 de 4');
    expect(within(region).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
    expect(within(region).getByRole('listitem', { name: /Cadastre uma conta/ })).toHaveTextContent('Feito');
    expect(within(region).queryByRole('link', { name: 'Cadastrar conta' })).not.toBeInTheDocument();
    expect(within(region).getByRole('link', { name: 'Lançar agora' })).toHaveAttribute('href', '/lancamentos?novo=1');
    expect(within(region).getByRole('link', { name: 'Importar extrato' })).toHaveAttribute('href', '/importar');
    expect(within(region).getByRole('link', { name: 'Definir limite' })).toHaveAttribute('href', '/planejamento');
    expect(within(region).getByRole('link', { name: 'Criar meta' })).toHaveAttribute('href', '/planejamento?aba=metas');
  });

  it('conta nova: zero de quatro, e o primeiro passo abre Contas com o formulário (G4)', async () => {
    renderApp(<OnboardingCard />, { api: fakeApi({ 'GET /onboarding': steps({ account: false }) }) });
    const region = await card();
    expect(region).toHaveTextContent('0 de 4');
    expect(within(region).getByRole('link', { name: 'Cadastrar conta' })).toHaveAttribute('href', '/contas?novo=1');
  });

  it('com os quatro passos feitos, o quadro não aparece (G3)', async () => {
    const client = fakeApi({ 'GET /onboarding': steps({ transaction: true, budget: true, goal: true }) });
    renderApp(<OnboardingCard />, { api: client });
    await waitFor(() => expect(client.get).toHaveBeenCalledWith('/onboarding'));
    await settle();
    expect(screen.queryByRole('region', { name: 'Primeiros passos' })).not.toBeInTheDocument();
  });

  it('"Ocultar" esconde o quadro, e a escolha fica lembrada neste navegador (G3)', async () => {
    const { unmount } = renderApp(<OnboardingCard />, { api: fakeApi({ 'GET /onboarding': steps() }) });
    await userEvent.click(within(await card()).getByRole('button', { name: 'Ocultar' }));
    expect(screen.queryByRole('region', { name: 'Primeiros passos' })).not.toBeInTheDocument();
    unmount();
    renderApp(<OnboardingCard />, { api: fakeApi({ 'GET /onboarding': steps() }) });
    await settle();
    expect(screen.queryByRole('region', { name: 'Primeiros passos' })).not.toBeInTheDocument();
  });

  it('na demo não busca os passos nem mostra o quadro (G1)', async () => {
    const client = fakeApi({ 'GET /onboarding': steps() });
    renderApp(<OnboardingCard />, { api: client, gateway: fakeGateway(signedIn(true)).gateway });
    await settle();
    expect(client.get).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'Primeiros passos' })).not.toBeInTheDocument();
  });

  it('erro ao buscar os passos: o quadro não aparece (G6)', async () => {
    const client = fakeApi({ 'GET /onboarding': () => new ApiError(500, 'Erro', 'Falhou.') });
    renderApp(<OnboardingCard />, { api: client });
    await waitFor(() => expect(client.get).toHaveBeenCalledWith('/onboarding'));
    await settle();
    expect(screen.queryByRole('region', { name: 'Primeiros passos' })).not.toBeInTheDocument();
  });
});
