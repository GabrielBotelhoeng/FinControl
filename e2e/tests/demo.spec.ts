import { expect, test } from '@playwright/test';
import { enterDemo } from './helpers';

test('visitante entra pela demo em um clique e vê 6 meses de dados', async ({ page }) => {
  await enterDemo(page);
  await expect(page.getByText('Saldo em todas as contas')).toBeVisible();
  // Seed completo: as recorrências passadas ficam pagas e só uma conta de propósito como vencida.
  await expect(page.getByText(/· 1 vencido$/)).toBeVisible();
  // Indicadores de saúde financeira calculados sobre os 6 meses da demo.
  await expect(page.getByRole('group', { name: 'Taxa de poupança' })).toContainText('%');
  await expect(page.getByRole('group', { name: 'Reserva de emergência' })).toContainText(/\d+(,\d)? m(eses|ês)/);
  await expect(page.getByRole('heading', { name: 'Últimos 6 meses' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A pagar' })).toBeVisible();
});
