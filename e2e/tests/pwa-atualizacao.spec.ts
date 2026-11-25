import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { openSite } from './helpers';

/**
 * Atualização do PWA (sub-projeto 19). O E2E usa a build de produção servida pelo preview; o service worker, bloqueado no
 * resto dos testes (playwright.config.ts), fica liberado nos dois primeiros. A "versão nova" é o `dist/sw.js` com outra
 * revisão: o mesmo arquivo com um ouvinte a mais, que responde "nova" a uma mensagem. Assim dá para saber, pela página,
 * qual service worker a controla. O arquivo original volta depois de cada teste.
 */
const SW_FILE = '../apps/web/dist/sw.js';
const original = readFileSync(SW_FILE, 'utf8');

function publishNewRevision() {
  writeFileSync(
    SW_FILE,
    `${original}\n// Revisão do E2E (pwa-atualizacao.spec.ts)\nself.addEventListener('message', (e) => { if (e.data === 'e2e-revisao') e.source.postMessage('nova'); });\n`,
  );
}

/** A página está sob um service worker (o `clientsClaim` faz o primeiro assumir sem recarregar). */
async function waitControlled(page: Page) {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 15_000 });
}

/** "nova" se a página é controlada pelo service worker da revisão nova; "antiga" se ninguém responde. */
const controllerRevision = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string>((done) => {
        const sw = navigator.serviceWorker;
        const timer = setTimeout(() => done('antiga'), 1500);
        sw.addEventListener('message', (e) => {
          clearTimeout(timer);
          done(String(e.data));
        });
        sw.controller?.postMessage('e2e-revisao');
      }),
  );

/** A pessoa volta para a aba: o app procura atualização (A3). */
const backToTab = (page: Page) => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

const notice = (page: Page) => page.getByRole('status').filter({ hasText: 'Nova versão disponível' });

test.describe('com o service worker', () => {
  test.use({ serviceWorkers: 'allow' });
  test.afterEach(() => writeFileSync(SW_FILE, original));

  test('site público: a primeira instalação não avisa; a versão nova, ao voltar para a aba, avisa', async ({ page }) => {
    await openSite(page, '/');
    await waitControlled(page);
    // O SW assumiu a página pela primeira vez (clientsClaim): não é versão nova.
    await page.waitForTimeout(1000);
    await expect(notice(page)).toHaveCount(0);

    publishNewRevision();
    await backToTab(page);
    await expect(notice(page)).toBeVisible({ timeout: 15_000 });
    await expect(notice(page).getByRole('button', { name: 'Atualizar' })).toBeVisible();
    // O SW novo já assumiu (skipWaiting + clientsClaim), sem fechar a aba.
    expect(await controllerRevision(page)).toBe('nova');
  });

  test('formulário aberto: o aviso não recarrega nem tira o foco; Atualizar recarrega com o SW novo e a sessão intacta', async ({ page }) => {
    await openSite(page, '/entrar');
    await waitControlled(page);
    await page.evaluate(() => localStorage.setItem('fincontrol-theme', 'light'));
    const storageBefore = await page.evaluate(() => JSON.stringify({ ...localStorage }));

    const email = page.getByLabel('E-mail');
    await email.fill('pessoa@exemplo.com');
    // Marca na página: some se ela recarregar.
    await page.evaluate(() => ((window as unknown as { __semRecarga: boolean }).__semRecarga = true));

    publishNewRevision();
    await backToTab(page);
    await expect(notice(page)).toBeVisible({ timeout: 15_000 });
    expect(await controllerRevision(page)).toBe('nova');

    // Sem o clique, nada recarregou: o e-mail continua digitado e com o cursor.
    await page.waitForTimeout(1000);
    expect(await page.evaluate(() => (window as unknown as { __semRecarga?: boolean }).__semRecarga)).toBe(true);
    await expect(email).toHaveValue('pessoa@exemplo.com');
    await expect(email).toBeFocused();

    await Promise.all([page.waitForEvent('load'), notice(page).getByRole('button', { name: 'Atualizar' }).click()]);
    await page.locator('html[data-app-ready]').waitFor({ state: 'attached' });
    expect(await page.evaluate(() => (window as unknown as { __semRecarga?: boolean }).__semRecarga)).toBeUndefined();
    await waitControlled(page);
    expect(await controllerRevision(page)).toBe('nova');
    // Depois de recarregar sob o SW novo, não há versão nova a avisar.
    await expect(notice(page)).toHaveCount(0);
    // Nada do armazenamento foi apagado (A5).
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).toBe(storageBefore);
  });
});

test('um pedaço que sumiu depois do deploy mostra o aviso e a tela de erro em português', async ({ page }) => {
  await page.route(/\/assets\/privacy-page-[\w-]+\.js$/, (route) => route.fulfill({ status: 404, contentType: 'text/html', body: 'Não encontrado' }));
  await openSite(page, '/entrar');
  // A entrada tem o aviso de idade em dois lugares (celular e computador): o link visível.
  await page.getByRole('link', { name: 'Política de privacidade' }).locator('visible=true').first().click();
  await expect(notice(page)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Saiu uma versão nova do FinControl' })).toBeVisible();
});

test('o boot que não carrega recarrega a página uma vez só (sem laço)', async ({ page }) => {
  let bootRequests = 0;
  await page.route(/\/assets\/boot-[\w-]+\.js$/, (route) => {
    bootRequests++;
    return route.fulfill({ status: 404, contentType: 'text/html', body: 'Não encontrado' });
  });
  // A recarga pode vir antes do primeiro `load`: conta as navegações da página, não os eventos de carga.
  let navigations = 0;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++;
  });
  await page.goto('/entrar');
  await expect.poll(() => navigations, { timeout: 10_000 }).toBe(2);
  // Dá tempo para um laço aparecer, se houvesse.
  await page.waitForTimeout(3000);
  expect(navigations).toBe(2);
  expect(bootRequests).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => sessionStorage.getItem('fincontrol-recarga-versao'))).not.toBeNull();
});
