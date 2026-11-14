import { expect, test } from '@playwright/test';
import { createAccount, openNewTransaction, signUp, uniqueEmail } from './helpers';

test('compra no cartão vai para a fatura, e pagar a fatura tira da corrente e libera o limite', async ({ page }) => {
  await signUp(page, { name: 'Bia Cartão', email: uniqueEmail('cartao') });
  await createAccount(page, 'Corrente', '500000');

  await page.getByRole('button', { name: 'Nova conta' }).first().click();
  const accountDialog = page.getByRole('dialog', { name: 'Nova conta' });
  await accountDialog.getByLabel('Nome').fill('Cartão Roxo');
  await accountDialog.getByLabel('Tipo').selectOption({ label: 'Cartão de crédito' });
  await accountDialog.getByLabel('Limite').fill('800000');
  await accountDialog.getByLabel('Dia de fechamento').fill('26');
  await accountDialog.getByLabel('Dia de vencimento').fill('5');
  await accountDialog.getByLabel('Conta para pagar a fatura').selectOption({ label: 'Corrente' });
  await accountDialog.getByRole('button', { name: 'Salvar conta' }).click();
  await expect(accountDialog).toBeHidden();
  await expect(page.getByRole('article', { name: 'Cartão Roxo' })).toContainText('Disponível R$ 8.000,00 de R$ 8.000,00');

  const txDialog = await openNewTransaction(page);
  await txDialog.getByLabel('Valor').fill('30000');
  await txDialog.getByLabel('Descrição').fill('Jantar no cartão');
  await txDialog.getByLabel('Conta').selectOption({ label: 'Cartão Roxo' });
  await txDialog.getByLabel('Categoria').selectOption({ label: 'Alimentação' });
  await txDialog.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(txDialog).toBeHidden();

  await page.goto('/contas');
  const card = page.getByRole('article', { name: 'Cartão Roxo' });
  await expect(card).toContainText('Disponível R$ 7.700,00 de R$ 8.000,00');
  await card.getByRole('link', { name: 'Ver faturas' }).click();

  const invoice = page.getByRole('region', { name: 'Fatura aberta' });
  await expect(invoice).toContainText('Valor R$ 300,00');
  await expect(invoice).toContainText('Aberta');
  await expect(invoice).toContainText('Jantar no cartão');

  await invoice.getByRole('button', { name: 'Pagar fatura' }).click();
  const payDialog = page.getByRole('dialog', { name: 'Pagar fatura' });
  await expect(payDialog.getByLabel('Conta pagadora')).toHaveValue(/.+/);
  await payDialog.getByRole('button', { name: 'Pagar fatura' }).click();
  await expect(payDialog).toBeHidden();
  await expect(page.getByText('Pagamento registrado.')).toBeVisible();

  await page.goto('/contas');
  await expect(page.getByRole('article', { name: 'Corrente' })).toContainText('4.700,00');
  await expect(page.getByRole('article', { name: 'Cartão Roxo' })).toContainText('Disponível R$ 8.000,00 de R$ 8.000,00');
});
