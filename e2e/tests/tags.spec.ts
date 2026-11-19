import { expect, test } from '@playwright/test';
import { createAccount, openNewTransaction, signUp, uniqueEmail } from './helpers';

test('tags: lançamento marcado aparece com a tag e o filtro mostra só ele (sub-projeto 13)', async ({ page }) => {
  await signUp(page, { name: 'Tina Tag', email: uniqueEmail('tags') });
  await createAccount(page, 'Corrente', '500000');

  for (const [description, tag] of [['Cerveja no mercado', 'Bebida'], ['Pão', '']] as const) {
    const dialog = await openNewTransaction(page);
    await dialog.getByLabel('Valor').fill('2500');
    await dialog.getByLabel('Descrição').fill(description);
    if (tag) await dialog.getByLabel('Tags (opcional)').fill(tag);
    await dialog.getByRole('button', { name: 'Salvar lançamento' }).click();
    await expect(dialog).toBeHidden();
  }

  await expect(page.getByRole('listitem', { name: 'Cerveja no mercado' })).toContainText('#bebida');
  await page.getByRole('combobox', { name: 'Tag' }).selectOption('bebida');
  await expect(page.getByRole('listitem', { name: 'Pão' })).toBeHidden();
  await expect(page.getByRole('listitem', { name: 'Cerveja no mercado' })).toBeVisible();

  // T6: a tag aparece em Categorias com a quantidade.
  await page.goto('/categorias');
  await expect(page.getByRole('listitem', { name: '#bebida' })).toContainText('1 lançamento');
});
