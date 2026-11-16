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
    test.setTimeout(180_000); // inclui a sincronização real com o Banco Central (6 modalidades)
    await page.goto('/entrar');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${OUT}/entrada.png` });
    await enterDemo(page);
    await shoot(page, '/', 'painel.png');
    await shoot(page, '/lancamentos', 'lancamentos.png');
    await shoot(page, '/contas', 'contas.png');
    const faturas = await page.getByRole('article', { name: 'Cartão principal' }).getByRole('link', { name: 'Ver faturas' }).getAttribute('href');
    await shoot(page, faturas!, 'faturas.png');
    // Taxas reais do Banco Central para a comparação aparecer na imagem (só roda localmente, com SCREENSHOTS=1).
    const sync = await page.request.get('http://localhost:3334/api/v1/internal/cron/sync-bank-rates', {
      headers: { Authorization: 'Bearer e2e-cron-secret-with-at-least-32-chars' },
      timeout: 150_000,
    });
    if (!sync.ok()) throw new Error(`sync das taxas falhou: ${sync.status()}`);
    // O cron responde 200 mesmo quando o Banco Central falha ("kept"); sem veículos, a imagem sairia sem comparação.
    const results = (await sync.json()) as { modality: string; status: string }[];
    if (!results.some((r) => r.modality === 'Aquisição de veículos - Prefixado' && r.status === 'updated')) {
      throw new Error('Banco Central sem taxas de veículos agora; rode os screenshots de novo mais tarde.');
    }
    await page.goto('/emprestimos');
    const emprestimo = await page.getByRole('article', { name: 'Financiamento do carro' }).getByRole('link', { name: /Ver detalhes/ }).getAttribute('href');
    await shoot(page, emprestimo!, 'emprestimo.png');
    await shoot(page, '/planejamento', 'planejamento.png');
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
