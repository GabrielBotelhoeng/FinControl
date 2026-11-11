import { expect, test } from '@playwright/test';
import { createAccount, openNewTransaction, signUp, uniqueEmail } from './helpers';

test('usuário se cadastra, cria uma conta, lança uma despesa paga e o saldo da conta cai', async ({ page }) => {
  await signUp(page, { name: 'Ana Teste', email: uniqueEmail('cadastro') });
  await createAccount(page, 'Nubank', '100000');
  await expect(page.getByRole('article', { name: 'Nubank' })).toContainText('1.000,00');

  const dialog = await openNewTransaction(page);
  await dialog.getByLabel('Valor').fill('15000');
  await dialog.getByLabel('Descrição').fill('Mercado do mês');
  await dialog.getByLabel('Já está pago').check();
  await dialog.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Mercado do mês')).toBeVisible();

  await page.goto('/contas');
  await expect(page.getByRole('article', { name: 'Nubank' })).toContainText('850,00');
});
