import { expect, test } from '@playwright/test';
import { createAccount, signUp, uniqueEmail } from './helpers';

test('patrimônio: bem com data de compra, novo valor e a linha do painel (sub-projeto 11)', async ({ page }) => {
  await signUp(page, { name: 'Paula Patrimônio', email: uniqueEmail('patrimonio') });
  await createAccount(page, 'Corrente', '500000');

  await page.goto('/patrimonio');
  await expect(page.getByLabel('Patrimônio líquido hoje')).toContainText('5.000,00');
  await expect(page.getByText('Nenhum bem cadastrado')).toBeVisible();

  await page.getByRole('button', { name: 'Novo bem' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Novo bem' });
  await dialog.getByLabel('Nome').fill('Carro');
  await dialog.getByLabel('Tipo').selectOption('vehicle');
  await dialog.getByLabel('Valor hoje').fill('4000000');
  await dialog.getByLabel('Desde quando você tem').fill('2025-06-01');
  await dialog.getByLabel('Valor na compra (opcional)').fill('4500000');
  await dialog.getByRole('button', { name: 'Salvar bem' }).click();
  await expect(dialog).toBeHidden();

  // B5: o carro vale R$ 40 mil hoje, com R$ 5 mil a menos que na compra.
  const car = page.getByRole('article', { name: 'Carro' });
  await expect(car).toContainText('40.000,00');
  await expect(car).toContainText('desde 01/06/2025');
  await expect(page.getByLabel('Patrimônio líquido hoje')).toContainText('45.000,00');

  await car.getByRole('button', { name: 'Ver histórico e atualizar' }).click();
  const detail = page.getByRole('dialog', { name: 'Carro' });
  await detail.getByLabel('Novo valor').fill('3800000');
  await detail.getByRole('button', { name: 'Salvar valor' }).click();
  await expect(detail.getByRole('listitem')).toHaveCount(3);
  await detail.getByRole('button', { name: 'Fechar' }).click();
  await expect(page.getByLabel('Patrimônio líquido hoje')).toContainText('43.000,00');

  // B9: o painel mostra o mesmo número.
  await page.goto('/');
  await expect(page.getByText(/Patrimônio líquido:/)).toContainText('43.000,00');
});
