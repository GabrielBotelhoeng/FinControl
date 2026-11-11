import { expect, test } from '@playwright/test';
import { signUp, uniqueEmail } from './helpers';

test('"Excluir minha conta" apaga os dados e o usuário no provedor de identidade', async ({ page }) => {
  const email = uniqueEmail('exclusao');
  await signUp(page, { name: 'Carla Teste', email });

  await page.goto('/perfil');
  await page.getByRole('button', { name: 'Excluir minha conta' }).click();
  const dialog = page.getByRole('dialog', { name: 'Excluir sua conta' });
  await dialog.getByLabel('Digite EXCLUIR para confirmar').fill('EXCLUIR');
  await dialog.getByRole('button', { name: 'Excluir definitivamente' }).click();
  await expect(page).toHaveURL(/\/entrar/);

  // O usuário também sumiu do Auth: entrar com as mesmas credenciais falha.
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha-segura-123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.');
});
