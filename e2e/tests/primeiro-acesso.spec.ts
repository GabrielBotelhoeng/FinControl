import { expect, test } from '@playwright/test';
import { signUp, uniqueEmail } from './helpers';

test.describe('primeiro acesso a 360 px (sub-projeto 12)', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('conta nova vê os primeiros passos, cadastra a conta pelo passo e oculta o quadro', async ({ page }) => {
    await signUp(page, { name: 'Pedro Primeiro', email: uniqueEmail('primeiros') });
    const card = page.getByRole('region', { name: 'Primeiros passos' });
    await expect(card).toContainText('0 de 4');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'rolagem horizontal no painel com os primeiros passos').toBeLessThanOrEqual(0);

    // G4: o passo abre Contas com "Nova conta" aberto, e o ?novo=1 sai da URL.
    await card.getByRole('link', { name: 'Cadastrar conta' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nova conta' });
    await dialog.getByLabel('Nome').fill('Corrente');
    await dialog.getByLabel('Saldo inicial').fill('100000');
    await dialog.getByRole('button', { name: 'Salvar conta' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL('/contas');

    await page.goto('/');
    await expect(card).toContainText('1 de 4');
    // G3: ocultar vale também depois de recarregar.
    await card.getByRole('button', { name: 'Ocultar' }).click();
    await expect(card).toBeHidden();
    await page.reload();
    await expect(page.getByLabel('Saldo total')).toBeVisible();
    await expect(card).toBeHidden();
  });
});
