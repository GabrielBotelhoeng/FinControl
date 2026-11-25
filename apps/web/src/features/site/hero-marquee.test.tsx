import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeApi, fakeGateway } from '../../test/fakes';
import { renderApp } from '../../test/render';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MARQUEE_BACK_ITEMS, MARQUEE_ITEMS } from './marquee';
import SitePage from './site-page';

const routes = { '/entrar': <p>Tela de entrada</p> };

describe('herói e faixa do site', () => {
  it('o h1 e o botão principal estão no primeiro quadro', () => {
    renderApp(<SitePage />, { gateway: fakeGateway(null).gateway, route: '/', path: '/', extraRoutes: routes });
    const hero = screen.getByRole('region', { name: 'Seu dinheiro, sob controle.' });
    expect(within(hero).getByRole('heading', { level: 1, name: 'Seu dinheiro, sob controle.' })).toBeVisible();
    expect(within(hero).getByRole('button', { name: 'Experimentar sem cadastro' })).toBeVisible();
    expect(within(hero).getByRole('link', { name: /Criar conta grátis/ })).toHaveAttribute('href', '/entrar?modo=cadastro');
    expect(within(hero).getByText(/declara ter 18 anos ou mais/)).toBeInTheDocument();
  });

  it('"Experimentar sem cadastro" abre a demo uma vez só', async () => {
    const { gateway } = fakeGateway(null);
    const api = fakeApi({ 'POST /demo/seed': { seeded: true } });
    renderApp(<SitePage />, { gateway, api, route: '/', path: '/', extraRoutes: routes });
    const hero = screen.getByRole('region', { name: 'Seu dinheiro, sob controle.' });
    await userEvent.click(within(hero).getByRole('button', { name: 'Experimentar sem cadastro' }));
    expect(gateway.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('as duas faixas em X são lidas uma vez cada: a cópia que fecha o laço fica escondida do leitor de tela', () => {
    renderApp(<SitePage />, { gateway: fakeGateway(null).gateway, route: '/', path: '/', extraRoutes: routes });
    const strip = screen.getByRole('region', { name: 'O que o FinControl faz' });
    const lists = [...strip.querySelectorAll<HTMLElement>('ul')];
    expect(lists).toHaveLength(4);
    const [back, backCopy, front, frontCopy] = lists as [HTMLElement, HTMLElement, HTMLElement, HTMLElement] & HTMLElement[];
    expect(back).not.toHaveAttribute('aria-hidden');
    expect(front).not.toHaveAttribute('aria-hidden');
    expect(backCopy).toHaveAttribute('aria-hidden', 'true');
    expect(frontCopy).toHaveAttribute('aria-hidden', 'true');
    for (const item of MARQUEE_ITEMS) expect(within(front).getByText(item)).toBeInTheDocument();
    for (const item of MARQUEE_BACK_ITEMS) expect(within(back).getByText(item)).toBeInTheDocument();
    // A de trás vai para o outro lado; a seção corta o que passa da largura (sem rolagem horizontal).
    expect(back).toHaveClass('site-marquee-track-back');
    expect(front).not.toHaveClass('site-marquee-track-back');
    expect(strip).toHaveClass('overflow-hidden');
  });

  it('as duas faixas param com o mouse em cima da seção e com prefers-reduced-motion (CSS)', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/index.css'), 'utf8');
    const flat = css.replace(/\s+/g, ' ');
    expect(flat).toContain('.site-marquees:hover .site-marquee-track { animation-play-state: paused; }');
    expect(flat).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \*, \*::before, \*::after \{ animation: none !important;/);
  });
});
