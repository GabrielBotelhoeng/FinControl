import { expect, type Page } from '@playwright/test';

export const uniqueEmail = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemplo.com`;

/** Cadastro por e-mail e senha pela tela de entrada; o provedor falso confirma na hora, como o autoconfirm. */
export async function signUp(page: Page, opts: { name: string; email: string; password?: string }) {
  await page.goto('/entrar?modo=cadastro');
  await page.getByLabel('Nome').fill(opts.name);
  await page.getByLabel('E-mail').fill(opts.email);
  await page.getByLabel('Senha').fill(opts.password ?? 'senha-segura-123');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL('/');
}

/** Valores em centavos entram pela direita na máscara de dinheiro: "100000" vira R$ 1.000,00. */
export async function createAccount(page: Page, name: string, initialCents: string) {
  await page.goto('/contas');
  await page.getByRole('button', { name: 'Nova conta' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Nova conta' });
  await dialog.getByLabel('Nome').fill(name);
  await dialog.getByLabel('Saldo inicial').fill(initialCents);
  await dialog.getByRole('button', { name: 'Salvar conta' }).click();
  await expect(dialog).toBeHidden();
}

export async function openNewTransaction(page: Page) {
  await page.goto('/lancamentos');
  await page.getByRole('button', { name: 'Novo lançamento' }).first().click();
  return page.getByRole('dialog', { name: 'Novo lançamento' });
}

/**
 * Entra pela demo e só retorna quando o seed terminou e o app abriu.
 * Não basta esperar "Saldo em todas as contas": a tela de entrada tem um cartão decorativo com esse texto.
 */
export async function enterDemo(page: Page) {
  await page.goto('/entrar');
  await page.getByRole('button', { name: 'Experimentar sem cadastro' }).click();
  await expect(page).toHaveURL('/');
  // Só existe dentro do app em modo demo, em qualquer largura (o rótulo "Modo demo" some no celular).
  await expect(page.getByText('Criar conta de verdade')).toBeVisible();
}
