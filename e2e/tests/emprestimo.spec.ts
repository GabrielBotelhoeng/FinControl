import { expect, test } from '@playwright/test';
import { createAccount, signUp, uniqueEmail } from './helpers';

/** Hoje em São Paulo (AAAA-MM-DD): a 1ª parcela vence hoje para aparecer na lista do mês corrente. */
const todaySaoPaulo = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

test('cadastro de empréstimo mostra a taxa real, gera as parcelas e excluir apaga as pendentes', async ({ page }) => {
  await signUp(page, { name: 'Caio Crédito', email: uniqueEmail('emprestimo') });
  await createAccount(page, 'Corrente', '500000');

  await page.goto('/emprestimos');
  await page.getByRole('button', { name: 'Cadastrar empréstimo' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Novo empréstimo' });
  await dialog.getByLabel('Nome').fill('Empréstimo pessoal');
  await dialog.getByLabel('Banco').fill('Banco Exemplo');
  await dialog.getByLabel('Valor recebido').fill('1000000');
  await dialog.getByLabel('Valor da parcela').fill('60000');
  await dialog.getByLabel('Número de parcelas').fill('24');
  await dialog.getByLabel('Vencimento da 1ª parcela').fill(todaySaoPaulo());

  // Critério de aceite 4: a taxa real aparece antes de salvar.
  await expect(dialog).toContainText('Taxa real: 3,15% ao mês');
  await dialog.getByRole('button', { name: 'Salvar empréstimo' }).click();
  await expect(dialog).toBeHidden();

  const item = page.getByRole('article', { name: 'Empréstimo pessoal' });
  await expect(item).toContainText('0 de 24 pagas');
  await item.getByRole('link', { name: /Ver detalhes/ }).click();
  await expect(page.getByText('R$ 4.400,00 são juros', { exact: false })).toBeVisible();

  await page.goto('/lancamentos');
  const installment = page.getByText('Empréstimo pessoal (1/24)');
  await expect(installment).toBeVisible();
  await expect(page.getByText('1/24', { exact: true })).toBeVisible();

  await page.goto('/emprestimos');
  await page.getByRole('article', { name: 'Empréstimo pessoal' }).getByRole('link', { name: /Ver detalhes/ }).click();
  await page.getByRole('button', { name: 'Excluir empréstimo' }).click();
  await page.getByRole('dialog', { name: 'Excluir empréstimo?' }).getByRole('button', { name: 'Excluir' }).click();
  await expect(page).toHaveURL('/emprestimos');
  await expect(page.getByRole('heading', { name: 'Nenhum empréstimo ainda' })).toBeVisible();

  await page.goto('/lancamentos');
  await expect(page.getByText('Empréstimo pessoal (1/24)')).toHaveCount(0);
});
