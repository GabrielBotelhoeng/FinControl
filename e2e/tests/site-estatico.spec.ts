import { expect, test, type Page } from '@playwright/test';
import { enterDemo, openSite } from './helpers';

/**
 * HTML estático das páginas públicas (sub-projeto 18). O E2E usa o build de produção, e o preview serve como a Vercel
 * (vite.config.ts, previewLikeVercel): as páginas públicas do arquivo gerado, as rotas do app na casca e o resto no 404.
 */

/**
 * Registra, a cada mutação e a cada quadro desde o primeiro, se o HTML estático do site chegou a ficar visível. Roda antes
 * de qualquer script da página.
 */
async function watchStaticSite(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __staticSiteSeen: boolean };
    w.__staticSiteSeen = false;
    const check = () => {
      const root = document.querySelector('#root[data-prerendered-route]');
      const title = root?.querySelector('#site-titulo');
      if (root && title && getComputedStyle(root).display !== 'none' && title.getBoundingClientRect().height > 0) w.__staticSiteSeen = true;
    };
    new MutationObserver(check).observe(document, { subtree: true, childList: true, attributes: true });
    requestAnimationFrame(function loop() {
      check();
      if (performance.now() < 8000) requestAnimationFrame(loop);
    });
  });
}

const staticSiteSeen = (page: Page) => page.evaluate(() => (window as unknown as { __staticSiteSeen: boolean }).__staticSiteSeen);

/** Erros do console e da página (a hidratação que falha aparece aqui). */
function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('o HTML cru das páginas públicas já tem o h1, o texto e a cabeça própria; o JSON-LD só na home, sem preço pago', async ({ request }) => {
  const pages = [
    ['/', 'Seu dinheiro,', 'FinControl — controle financeiro pessoal no celular e no computador'],
    ['/privacidade', 'Política de Privacidade', 'Política de Privacidade — FinControl'],
    ['/termos', 'Termos de Uso', 'Termos de Uso — FinControl'],
  ] as const;
  for (const [path, h1, title] of pages) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    const html = await response.text();
    expect(html).toMatch(new RegExp(`<h1[^>]*>(<[^>]+>)*${h1}`));
    expect(html).toContain(`<title>${title}</title>`);
    expect(html).toContain(`<link rel="canonical" href="https://fincontrol-gb.vercel.app${path}" />`);
    expect(html).toContain(`<meta property="og:url" content="https://fincontrol-gb.vercel.app${path}" />`);
    expect(html).not.toContain('name="robots"');
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    expect(ld, path).toHaveLength(path === '/' ? 1 : 0);
    if (ld.length) {
      const offers = (JSON.parse(ld[0]![1]!) as { offers?: { price: string }[] }[]).flatMap((n) => n.offers ?? []);
      expect(offers.length).toBeGreaterThan(0);
      for (const offer of offers) expect(Number(offer.price)).toBe(0);
    }
  }
});

test('rota inexistente é 404 de verdade, e as rotas do app abrem a casca com noindex', async ({ request }) => {
  const missing = await request.get('/nao-existe');
  expect(missing.status()).toBe(404);
  const missingHtml = await missing.text();
  expect(missingHtml).toContain('<meta name="robots" content="noindex" />');
  expect(missingHtml).toContain('Página não encontrada');
  for (const path of ['/entrar', '/lancamentos', '/cartoes/qualquer', '/dividas/plano', '/perfil']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    const html = await response.text();
    expect(html, path).toContain('<meta name="robots" content="noindex" />');
    expect(html, path).toContain('<div id="root"></div>');
  }
});

test('o fundo flutuante não vem no HTML gerado (só o contêiner vazio) e entra depois da hidratação, sem erro (sub-projeto 20, V9)', async ({ page, request }) => {
  // HTML cru da /: os contêineres [data-backdrop] estão lá, vazios; nenhum elemento de fundo ([data-float]).
  const html = await (await request.get('/')).text();
  const containers = [...html.matchAll(/<div[^>]*data-backdrop[^>]*>(.*?)<\/div>/g)];
  expect(containers.length).toBeGreaterThanOrEqual(4);
  for (const [, inner] of containers) expect(inner).toBe('');
  expect(html).not.toContain('data-float');
  // No computador (onde o paralaxe monta) e no celular: a hidratação reaproveita os nós e os elementos chegam depois.
  for (const width of [390, 1440]) {
    const errors = collectErrors(page);
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/', { waitUntil: 'commit' });
    await page.waitForSelector('#site-titulo', { state: 'attached' });
    await page.evaluate(() => {
      (window as unknown as { __static: Element[] }).__static = [...document.querySelectorAll('#root *')];
    });
    await page.locator('html[data-app-ready]').waitFor({ state: 'attached' });
    await expect(page.locator('section[aria-labelledby="site-titulo"] [data-float]').first()).toBeAttached();
    // A 390 px, nenhum nó do HTML é trocado. A 1440 px os recursos trocam de propósito para a versão do computador depois
    // da hidratação (sub-projeto 17), então ali a conferência é só a do console.
    if (width === 390) {
      const detached = await page.evaluate(() => (window as unknown as { __static: Element[] }).__static.filter((n) => !n.isConnected).length);
      expect(detached).toBe(0);
    }
    expect(errors, `${width} px`).toEqual([]);
  }
});

test('sem sessão, a / hidrata o HTML estático (os mesmos nós, sem redesenhar) sem erro no console e continua interativa', async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'commit' });
  // Os nós do HTML estático, guardados antes de o app chegar: a hidratação precisa reaproveitá-los, não trocá-los.
  await page.waitForSelector('#site-titulo', { state: 'attached' });
  await page.evaluate(() => {
    (window as unknown as { __static: Element[] }).__static = [...document.querySelectorAll('#root *')];
  });
  await page.locator('html[data-app-ready]').waitFor({ state: 'attached' });
  await page.waitForTimeout(500);
  const detached = await page.evaluate(() => (window as unknown as { __static: Element[] }).__static.filter((n) => !n.isConnected).length);
  expect(detached).toBe(0);
  await expect(page.locator('html')).toHaveAttribute('data-boot', 'static');
  await expect(page.getByRole('heading', { level: 1, name: 'Seu dinheiro, sob controle.' })).toBeVisible();
  // Interativa depois da hidratação: a chave dos planos responde ao clique.
  await page.locator('#planos').scrollIntoViewIfNeeded();
  await page.getByRole('radiogroup', { name: 'Forma de pagamento' }).getByRole('radio', { name: /Anual/ }).click();
  await expect(page.getByTestId('preco-complete')).toContainText('por ano');
  expect(errors).toEqual([]);
});

test('as páginas legais hidratam sem erro, e o link entre elas troca a cabeça', async ({ page }) => {
  const errors = collectErrors(page);
  await openSite(page, '/privacidade');
  await expect(page.locator('html')).toHaveAttribute('data-boot', 'static');
  await expect(page.getByRole('heading', { level: 1, name: 'Política de Privacidade' })).toBeVisible();
  await page.getByRole('link', { name: 'Termos de Uso' }).first().click();
  await expect(page).toHaveURL('/termos');
  await expect(page).toHaveTitle('Termos de Uso — FinControl');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://fincontrol-gb.vercel.app/termos');
  expect(errors).toEqual([]);
});

test('com sessão guardada, a / abre o painel sem o site aparecer em nenhum quadro, na mesma chave de sempre', async ({ page }) => {
  await enterDemo(page);
  // A sessão fica na chave que o supabase-js usava (sub-projeto 18, E9): quem já estava logado continua logado.
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => /^sb-.+-auth-token$/.test(k)))).toEqual(['sb-localhost-auth-token']);
  await watchStaticSite(page);
  await page.goto('/');
  await expect(page.getByText('Criar conta de verdade')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-boot', 'app');
  expect(await staticSiteSeen(page)).toBe(false);
  // E uma rota privada abre direto (servida pela casca do app).
  await page.goto('/lancamentos');
  await expect(page).toHaveURL('/lancamentos');
  await expect(page.getByRole('heading', { level: 1, name: /lançamentos/i })).toBeVisible();
});

test('no retorno de login pela URL, o site estático não aparece em nenhum quadro', async ({ page }) => {
  await watchStaticSite(page);
  await page.goto('/#error=access_denied&error_description=cancelado');
  await expect(page.locator('html')).toHaveAttribute('data-boot', 'app');
  await page.waitForLoadState('load');
  await page.waitForTimeout(500);
  expect(await staticSiteSeen(page)).toBe(false);
});

test('no app instalado, a / vai para a entrada sem o site aparecer em nenhum quadro', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    const noop = () => {};
    window.matchMedia = (query: string) =>
      query === '(display-mode: standalone)'
        ? ({ matches: true, media: query, onchange: null, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop, dispatchEvent: () => false } as MediaQueryList)
        : original(query);
  });
  await watchStaticSite(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/entrar/);
  expect(await staticSiteSeen(page)).toBe(false);
});

test('um toque no botão antes da hidratação não se perde: é repetido quando o app assume', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' });
  await page.getByRole('region', { name: 'Seu dinheiro, sob controle.' }).getByRole('button', { name: 'Experimentar sem cadastro' }).click();
  await expect(page.getByText('Criar conta de verdade')).toBeVisible();
});

test('/entrar abre a entrada pela casca do app', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/entrar');
  await expect(page.getByRole('button', { name: 'Experimentar sem cadastro' })).toBeVisible();
  expect(errors).toEqual([]);
});
