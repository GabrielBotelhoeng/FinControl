import { expect, test } from '@playwright/test';
import { createAccount, openNewTransaction, signUp, uniqueEmail } from './helpers';

/** Data em São Paulo daqui a `months` meses (dia 1, sempre válido). */
function firstDayInMonths(months: number): string {
  const [y, m] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()).split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + months, 1));
  return d.toISOString().slice(0, 10);
}

test('limite por categoria avisa "Perto do limite", e a meta acompanha os depósitos', async ({ page }) => {
  await signUp(page, { name: 'Pia Plano', email: uniqueEmail('planejamento') });
  await createAccount(page, 'Corrente', '500000');

  // Limite de R$ 500 em Alimentação.
  await page.goto('/planejamento');
  await page.getByRole('article', { name: 'Alimentação' }).getByRole('button', { name: 'Definir limite' }).click();
  const limitDialog = page.getByRole('dialog', { name: 'Limite de Alimentação' });
  await limitDialog.getByLabel('Limite mensal').fill('50000');
  await limitDialog.getByRole('button', { name: 'Salvar limite' }).click();
  await expect(limitDialog).toBeHidden();

  // Despesa paga de R$ 450 em Alimentação → 90%, "Perto do limite" (critério 1).
  const tx = await openNewTransaction(page);
  await tx.getByLabel('Valor').fill('45000');
  await tx.getByLabel('Descrição').fill('Mercado do mês');
  await tx.getByLabel('Categoria').selectOption({ label: 'Alimentação' });
  await tx.getByLabel('Já está pago').check();
  await tx.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(tx).toBeHidden();

  await page.goto('/planejamento');
  const food = page.getByRole('article', { name: 'Alimentação' });
  await expect(food).toContainText('R$ 450,00 de R$ 500,00');
  await expect(food).toContainText('Perto do limite');

  // Meta de R$ 4.000 em 6 meses com um depósito de R$ 1.000 (critério 4).
  await page.getByRole('tab', { name: 'Metas' }).click();
  await page.getByRole('button', { name: 'Nova meta' }).first().click();
  const goalDialog = page.getByRole('dialog', { name: 'Nova meta' });
  await goalDialog.getByLabel('Nome').fill('Notebook');
  await goalDialog.getByLabel('Valor da meta').fill('400000');
  await goalDialog.getByLabel('Prazo').fill(firstDayInMonths(6));
  await goalDialog.getByRole('button', { name: 'Salvar meta' }).click();
  await expect(goalDialog).toBeHidden();

  await page.getByRole('article', { name: 'Notebook' }).getByRole('button', { name: 'Ver detalhes' }).click();
  const detail = page.getByRole('dialog', { name: 'Notebook' });
  await detail.getByLabel('Valor').fill('100000');
  await detail.getByRole('button', { name: 'Registrar depósito' }).click();
  await expect(detail).toContainText('R$ 1.000,00 guardados de R$ 4.000,00');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('article', { name: 'Notebook' })).toContainText('R$ 1.000,00 de R$ 4.000,00');
  await expect(page.getByRole('article', { name: 'Notebook' })).toContainText('25%');
});
