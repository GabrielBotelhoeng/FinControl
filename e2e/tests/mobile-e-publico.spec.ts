import { expect, test } from '@playwright/test';
import { enterDemo } from './helpers';

test.describe('tela de 360 px', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('nenhuma página tem rolagem horizontal', async ({ page }) => {
    await enterDemo(page);
    await page.goto('/contas');
    const faturas = await page.getByRole('article', { name: 'Cartão principal' }).getByRole('link', { name: 'Ver faturas' }).getAttribute('href');
    await page.goto('/emprestimos');
    const emprestimo = await page.getByRole('article', { name: 'Financiamento do carro' }).getByRole('link', { name: /Ver detalhes/ }).getAttribute('href');

    const paths = [
      '/', '/lancamentos', '/contas', faturas!, '/emprestimos', emprestimo!, '/planejamento', '/planejamento?aba=metas',
      '/relatorios', '/notificacoes', '/categorias', '/perfil', '/privacidade', '/termos',
    ];
    for (const path of paths) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `rolagem horizontal em ${path}`).toBeLessThanOrEqual(0);
      // A área principal usa overflow-x: clip, que esconde o que passa da tela sem gerar rolagem: mede os elementos.
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll('main *')].filter((el) => {
          if (el.getBoundingClientRect().right <= document.documentElement.clientWidth + 0.5) return false;
          // Dentro de uma área com rolagem própria (ex.: filtros de Lançamentos), passar da borda é intencional.
          for (let p = el.parentElement; p && p.tagName !== 'MAIN'; p = p.parentElement) {
            if (['auto', 'scroll'].includes(getComputedStyle(p).overflowX)) return false;
          }
          return true;
        }).length,
      );
      expect(clipped, `conteúdo cortado na borda em ${path}`).toBe(0);
      // Cabeçalho (logo, selo da demo e sino): nada transborda da própria caixa, passa da borda ou fica por baixo do sino.
      const header = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        const all = [...document.querySelectorAll('header *')] as HTMLElement[];
        // Páginas públicas (privacidade, termos) não têm sino.
        const bellEl = document.querySelector('header a[href="/notificacoes"]');
        // O selo do sino fica por fora do círculo de propósito: o sino e quem só o envolve ficam fora desta conta.
        const overflowing = all
          .filter((el) => !bellEl || (!el.contains(bellEl) && !bellEl.contains(el)))
          .filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible')
          .map((el) => `${el.tagName}.${el.className}`.slice(0, 80));
        const outside = all.some((el) => el.getBoundingClientRect().right > width + 0.5);
        const bell = bellEl?.getBoundingClientRect();
        const underBell = all.filter((el) => {
          if (!bellEl || !bell || bellEl.contains(el) || el.contains(bellEl)) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.left < bell.right - 0.5 && bell.left < r.right - 0.5 && r.top < bell.bottom - 0.5 && bell.top < r.bottom - 0.5;
        }).length;
        return { overflowing, outside, underBell };
      });
      expect(header, `cabeçalho em ${path}`).toEqual({ overflowing: [], outside: false, underBell: 0 });
    }
  });
});

test('a política de privacidade é pública e está ligada na tela de entrada', async ({ page }) => {
  await page.goto('/entrar');
  await page.getByRole('link', { name: 'Política de privacidade' }).first().click();
  await expect(page).toHaveURL('/privacidade');
  await expect(page.getByRole('heading', { level: 1, name: 'Política de Privacidade' })).toBeVisible();
});

test('os termos de uso são públicos, estão ligados na entrada e exigem 18 anos', async ({ page }) => {
  await page.goto('/entrar');
  await expect(page.getByText(/declara ter 18 anos ou mais/).first()).toBeVisible();
  await page.getByRole('link', { name: 'Termos de Uso' }).first().click();
  await expect(page).toHaveURL('/termos');
  await expect(page.getByRole('heading', { level: 1, name: 'Termos de Uso' })).toBeVisible();
  await expect(page.getByText(/maiores de 18 anos/)).toBeVisible();
});

test('rota protegida sem sessão leva para a entrada', async ({ page }) => {
  await page.goto('/lancamentos');
  await expect(page).toHaveURL(/\/entrar/);
});
