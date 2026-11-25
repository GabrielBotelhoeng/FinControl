import { readFileSync, statSync } from 'node:fs';
import { test, type Locator, type Page } from '@playwright/test';
import { enterDemo } from './helpers';

/**
 * Capturas reais da demo para o site de apresentação (sub-projeto 17, S9). Fora do CI:
 * `SITE_CAPTURES=1 npm run test:e2e -- site-capturas` e depois `npm run site:images -w @fincontrol/web`,
 * que converte os PNG desta pasta em WebP em `apps/web/public/site/` e compõe a `og-image.png`.
 */
test.skip(!process.env.SITE_CAPTURES, 'só roda com SITE_CAPTURES=1');

const OUT = '.site-capturas';
// Início desta execução, marcado uma vez só pelo global-setup.ts antes dos workers (um worker novo, depois de uma falha
// ou num retry, reavalia este arquivo): a og-image só usa capturas feitas nesta execução (CodeRabbit, PR #39).
const RUN_STARTED = Number(process.env.E2E_RUN_STARTED);

/** Abre a tela e fotografa a área visível; `focus` centraliza uma parte da tela antes (ex.: o resultado do plano). */
async function shoot(page: Page, path: string, file: string, focus?: (page: Page) => Locator) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  if (focus) await focus(page).evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(900); // animações dos gráficos e do saldo
  await page.screenshot({ path: `${OUT}/${file}.png` });
}

/** A fatura do cartão da demo: o link sai da lista de contas, como no teste das imagens do README. */
async function invoicesPath(page: Page) {
  await page.goto('/contas');
  const href = await page.getByRole('article', { name: 'Cartão principal' }).getByRole('link', { name: 'Ver faturas' }).first().getAttribute('href');
  if (!href) throw new Error('A demo não tem o "Cartão principal" com faturas.');
  return href;
}

test.describe('celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  test('telas do site no celular', async ({ page }) => {
    test.setTimeout(120_000);
    await enterDemo(page);
    await shoot(page, '/', 'painel-celular');
    await shoot(page, '/lancamentos', 'lancamentos-celular');
    await shoot(page, await invoicesPath(page), 'faturas-celular');
    await shoot(page, '/dividas/plano', 'quitacao-celular', (p) => p.getByRole('region', { name: 'Saldo devedor ao longo do tempo' }));
    await shoot(page, '/relatorios', 'relatorios-celular');
    // A demo nunca libera o assistente (só contas reais autorizadas). Aqui só a configuração é simulada, para a foto
    // mostrar a tela inicial verdadeira, com as sugestões de perguntas; nenhuma resposta é inventada.
    await page.route('**/api/v1/assistant/config', (route) => route.fulfill({ json: { enabled: true, allowed: true, consented: true } }));
    await shoot(page, '/assistente', 'assistente-celular');
  });
});

/** O iPad ao lado do notebook na seção "No celular" (sub-projeto 20, V8): `SITE_CAPTURES=1 npm run test:e2e -- site-capturas -g tablet`. */
test.describe('tablet', () => {
  test.use({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  test('painel no tablet', async ({ page }) => {
    test.setTimeout(120_000);
    await enterDemo(page);
    await shoot(page, '/', 'painel-tablet');
  });
});

test.describe('computador', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('telas do site no computador', async ({ page }) => {
    test.setTimeout(120_000);
    await enterDemo(page);
    await shoot(page, '/', 'painel-computador');
    await shoot(page, '/relatorios', 'relatorios-computador');
  });
});

/**
 * Imagem de compartilhamento (1200×630, Open Graph): composição em código com o logo, o título e a captura do painel num
 * celular em CSS, renderizada pelo próprio Chromium para usar a Outfit de verdade (o sharp não lê woff2). Sem IA.
 */
test.describe('compartilhamento', () => {
  test.use({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

  test('og-image', async ({ page }) => {
    const b64 = (path: string) => readFileSync(path).toString('base64');
    const font = b64('../node_modules/@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2');
    const logo = readFileSync('../apps/web/public/icon.svg', 'utf8');
    const panel = `${OUT}/painel-celular.png`;
    // Sem a captura do celular desta mesma execução, a imagem sairia com um painel velho: falha em vez de usá-lo.
    let modified = 0;
    try {
      modified = statSync(panel).mtimeMs;
    } catch {
      // Arquivo ausente: cai no erro abaixo.
    }
    if (!RUN_STARTED) throw new Error('E2E_RUN_STARTED ausente: o global-setup.ts não rodou.');
    if (modified < RUN_STARTED) {
      throw new Error(`${panel} não é desta execução. Rode o arquivo inteiro: SITE_CAPTURES=1 npm run test:e2e -- site-capturas`);
    }
    const shot = b64(panel);
    await page.setContent(`<!doctype html><html><head><style>
      @font-face { font-family: Outfit; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 100 900; }
      * { box-sizing: border-box; margin: 0; }
      body { width: 1200px; height: 630px; overflow: hidden; background: #F5F6F0; font-family: Outfit, sans-serif; color: #14170F; position: relative; }
      .glow { position: absolute; border-radius: 50%; filter: blur(70px); }
      .text { position: absolute; left: 80px; top: 92px; width: 640px; }
      .brand { display: flex; align-items: center; gap: 16px; font-size: 34px; font-weight: 700; letter-spacing: -0.02em; }
      .brand svg { width: 64px; height: 64px; }
      .brand b { color: #3D7A00; font-weight: 700; }
      h1 { margin-top: 56px; font-size: 84px; line-height: 1.1; letter-spacing: -0.03em; font-weight: 200; }
      h1 span { display: inline-block; margin-top: 10px; background: #C8F24B; border-radius: 22px; padding: 0 16px; font-weight: 800; }
      p { margin-top: 30px; font-size: 28px; color: #5F6657; letter-spacing: -0.01em; }
      .phone { position: absolute; right: 96px; top: 64px; width: 300px; border-radius: 46px; background: #14170F; padding: 10px; transform: rotate(4deg);
        box-shadow: 0 40px 80px -30px rgba(20,23,15,.5); }
      .phone img { display: block; width: 100%; border-radius: 37px; }
    </style></head><body>
      <span class="glow" style="right:-80px;top:-120px;width:520px;height:520px;background:rgba(200,242,75,.75)"></span>
      <span class="glow" style="left:-140px;bottom:-160px;width:420px;height:420px;background:rgba(255,138,61,.22)"></span>
      <div class="text">
        <div class="brand">${logo}<span>Fin<b>Control</b></span></div>
        <h1>Seu dinheiro,<br><span>sob controle.</span></h1>
        <p>Contas, cartões e metas no celular e no computador.</p>
      </div>
      <div class="phone"><img src="data:image/png;base64,${shot}" alt=""></div>
    </body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${OUT}/og-image.png` });
  });
});
