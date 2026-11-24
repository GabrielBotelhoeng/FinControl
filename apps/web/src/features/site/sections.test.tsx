import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fakeGateway } from '../../test/fakes';
import { renderApp } from '../../test/render';
import { FEATURES } from './features';
import { renderSitePage } from './render-site';
import SitePage from './site-page';

const renderSite = () => renderSitePage({ gateway: fakeGateway(null).gateway });

describe('seções do site', () => {
  it('"Como funciona" mostra os três passos na ordem', async () => {
    await renderSite();
    const section = screen.getByRole('region', { name: /Três passos/ });
    const steps = within(section).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(steps).toEqual(['Cadastre suas contas', 'Lance ou importe o extrato', 'Veja para onde vai o dinheiro']);
  });

  it('recursos: cada recurso tem texto e captura com descrição, e a âncora #recursos', async () => {
    await renderSite();
    const section = document.getElementById('recursos')!;
    for (const f of FEATURES) {
      expect(within(section).getAllByRole('heading', { level: 3, name: f.title }).length).toBeGreaterThan(0);
      expect(within(section).getAllByRole('img', { name: f.capture.alt }).length).toBeGreaterThan(0);
    }
  });

  it('"Seus dados" traz as quatro garantias e liga para a privacidade e os termos', async () => {
    await renderSite();
    const section = screen.getByRole('region', { name: /assunto seu/ });
    expect(within(section).getAllByRole('listitem')).toHaveLength(4);
    expect(within(section).getByRole('link', { name: 'Política de privacidade' })).toHaveAttribute('href', '/privacidade');
    expect(within(section).getByRole('link', { name: 'Termos de Uso' })).toHaveAttribute('href', '/termos');
  });

  it('continua com um h1 só depois das seções novas', async () => {
    await renderSite();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});

describe('entrada das seções', () => {
  it('sem âncora, o primeiro quadro tem só o herói, e as outras seções entram logo depois, até o rodapé', async () => {
    renderApp(<SitePage />, { gateway: fakeGateway(null).gateway, route: '/', path: '/' });
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(document.getElementById('planos')).toBeNull();
    expect(await screen.findByRole('contentinfo', undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(document.getElementById('planos')).not.toBeNull();
  }, 10_000);
});
