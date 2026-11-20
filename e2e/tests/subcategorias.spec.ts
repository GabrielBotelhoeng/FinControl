import { expect, test } from '@playwright/test';
import { createAccount, openNewTransaction, signUp, uniqueEmail } from './helpers';

test('subcategorias: criar em Categorias, lançar nela e ver na linha e no relatório (sub-projeto 15)', async ({ page }) => {
  await signUp(page, { name: 'Sara Sub', email: uniqueEmail('sub') });
  await createAccount(page, 'Corrente', '500000');

  await page.goto('/categorias');
  await page.getByRole('button', { name: 'Nova subcategoria em Alimentação' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nova subcategoria em Alimentação' });
  await dialog.getByLabel('Nome').fill('Restaurante');
  await dialog.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('list', { name: 'Subcategorias de Alimentação' })).toContainText('Restaurante');

  const form = await openNewTransaction(page);
  await form.getByLabel('Valor').fill('4500');
  await form.getByLabel('Descrição').fill('Pizza');
  await form.getByLabel('Categoria').selectOption({ label: 'Alimentação › Restaurante' });
  await form.getByLabel('Já está pago').check();
  await form.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(form).toBeHidden();
  await expect(page.getByRole('listitem', { name: 'Pizza' })).toContainText('Alimentação › Restaurante');

  // U5 e U7: a despesa soma em Alimentação, com o detalhe da subcategoria.
  await page.goto('/relatorios');
  const food = page.getByRole('list', { name: 'Gastos por categoria' }).getByRole('listitem', { name: 'Alimentação' });
  await expect(food).toContainText(/R\$\s45,00/);
  await expect(food.getByRole('list', { name: 'Subcategorias de Alimentação' }).getByRole('listitem', { name: 'Restaurante' })).toContainText(/R\$\s45,00/);
});
