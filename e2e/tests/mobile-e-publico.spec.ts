import { expect, test } from '@playwright/test';
import { enterDemo } from './helpers';

test.describe('tela de 360 px', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('nenhuma página tem rolagem horizontal', async ({ page }) => {
    await enterDemo(page);

    for (const path of ['/', '/lancamentos', '/contas', '/categorias', '/perfil', '/privacidade']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `rolagem horizontal em ${path}`).toBeLessThanOrEqual(0);
    }
  });
});

test('a política de privacidade é pública e está ligada na tela de entrada', async ({ page }) => {
  await page.goto('/entrar');
  await page.getByRole('link', { name: 'Política de privacidade' }).click();
  await expect(page).toHaveURL('/privacidade');
  await expect(page.getByRole('heading', { level: 1, name: 'Política de Privacidade' })).toBeVisible();
});

test('rota protegida sem sessão leva para a entrada', async ({ page }) => {
  await page.goto('/lancamentos');
  await expect(page).toHaveURL(/\/entrar/);
});
