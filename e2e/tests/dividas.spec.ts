import { expect, test } from '@playwright/test';
import { createAccount, signUp, uniqueEmail } from './helpers';

test('dívida com credor: cadastro com juros, acordo com parcelas em Lançamentos e cancelamento', async ({ page }) => {
  await signUp(page, { name: 'Dora Dívida', email: uniqueEmail('dividas') });
  await createAccount(page, 'Corrente', '500000');

  await page.goto('/dividas');
  await page.getByRole('button', { name: 'Nova dívida' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Nova dívida' });
  await dialog.getByLabel('Nome').fill('Crediário do sofá');
  await dialog.getByLabel('Credor').fill('Loja de móveis');
  await dialog.getByLabel('Valor original').fill('100000');
  await dialog.getByLabel('Valor hoje (opcional)').fill('130000');
  await expect(dialog).toContainText('R$ 300,00 de juros e multas desde o começo.');
  await dialog.getByRole('button', { name: 'Salvar dívida' }).click();

  // O cadastro abre o detalhe.
  await expect(page).toHaveURL(/\/dividas\/[0-9a-f-]+$/);
  const numbers = page.getByRole('group', { name: 'Números da dívida' });
  await expect(numbers).toContainText('R$ 300,00');
  await expect(numbers).toContainText('R$ 1.300,00');

  await page.getByRole('button', { name: 'Fechar acordo' }).click();
  const agreement = page.getByRole('dialog', { name: 'Fechar acordo' });
  await agreement.getByLabel('Entrada (opcional)').fill('10000');
  await agreement.getByLabel('Número de parcelas').fill('4');
  await agreement.getByLabel('Valor da parcela').fill('20000');
  await expect(agreement).toContainText('Total do acordo R$ 900,00: R$ 400,00 de desconto.');
  await agreement.getByRole('button', { name: 'Fechar acordo' }).click();
  await expect(agreement).toBeHidden();
  await expect(page.getByRole('region', { name: 'Acordo' })).toContainText('4ª parcela');
  await expect(page.getByText('Em acordo')).toBeVisible();

  // A entrada já paga aparece em Lançamentos no mês de hoje.
  await page.goto('/lancamentos');
  await expect(page.getByText('Entrada do acordo Crediário do sofá')).toBeVisible();

  await page.goto('/dividas');
  const item = page.getByRole('article', { name: 'Crediário do sofá' });
  await expect(item).toContainText('Em acordo');
  await item.getByRole('link', { name: /Ver detalhes/ }).click();
  await page.getByRole('button', { name: 'Cancelar acordo' }).click();
  await page.getByRole('dialog', { name: 'Cancelar acordo?' }).getByRole('button', { name: 'Cancelar acordo' }).click();
  await expect(page.getByText('Em aberto')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Histórico' })).toContainText('Acordo cancelado');
});
