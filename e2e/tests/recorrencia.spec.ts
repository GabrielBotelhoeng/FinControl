import { expect, test, type Page } from '@playwright/test';
import { createAccount, openNewTransaction, signUp, uniqueEmail } from './helpers';

const occurrences = (page: Page) => page.getByText('Internet', { exact: true });

test('despesa mensal aparece uma vez em cada mês seguinte, sem duplicar ao recarregar', async ({ page }) => {
  await signUp(page, { name: 'Bruno Teste', email: uniqueEmail('recorrencia') });
  await createAccount(page, 'Conta corrente', '50000');

  const dialog = await openNewTransaction(page);
  await dialog.getByLabel('Valor').fill('9990');
  await dialog.getByLabel('Descrição').fill('Internet');
  await dialog.getByLabel('Repetir este lançamento').check();
  await dialog.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(dialog).toBeHidden();
  await expect(occurrences(page)).toHaveCount(1);

  for (let month = 1; month <= 2; month++) {
    await page.getByRole('button', { name: 'Próximo mês' }).click();
    await expect(occurrences(page)).toHaveCount(1);
  }

  await page.reload();
  await expect(page.getByRole('button', { name: 'Próximo mês' })).toBeVisible();
  // Depois de recarregar, as ocorrências já materializadas não podem duplicar em nenhum mês.
  for (let month = 0; month <= 2; month++) {
    await expect(occurrences(page)).toHaveCount(1);
    await page.getByRole('button', { name: 'Próximo mês' }).click();
  }
});
