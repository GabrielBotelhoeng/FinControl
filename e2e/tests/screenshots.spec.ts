import { test, type Page } from '@playwright/test';
import { enterDemo } from './helpers';

/** Gera as imagens do README a partir da demo. Fora do CI: `SCREENSHOTS=1 npm run test:e2e -- screenshots`. */
test.skip(!process.env.SCREENSHOTS, 'só roda com SCREENSHOTS=1');

const OUT = '../docs/screenshots';

async function shoot(page: Page, path: string, file: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800); // animações dos gráficos
  await page.screenshot({ path: `${OUT}/${file}` });
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('telas principais', async ({ page }) => {
    await page.goto('/entrar');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${OUT}/entrada.png` });
    await enterDemo(page);
    await shoot(page, '/', 'painel.png');
    await shoot(page, '/lancamentos', 'lancamentos.png');
    await shoot(page, '/contas', 'contas.png');
  });
});

test.describe('celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  test('painel e lançamentos', async ({ page }) => {
    await enterDemo(page);
    await shoot(page, '/', 'celular-painel.png');
    await shoot(page, '/lancamentos', 'celular-lancamentos.png');
  });
});
