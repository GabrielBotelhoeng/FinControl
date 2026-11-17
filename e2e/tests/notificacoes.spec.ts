import { expect, test } from '@playwright/test';
import { enterDemo } from './helpers';

test('demo: o sino mostra os não lidos, a ação marca como lido e "marcar todas" zera', async ({ page }) => {
  await enterDemo(page);
  const bell = page.getByRole('link', { name: /^Notificações, \d+ não lidas?$/ });
  await expect(bell).toBeVisible();
  const before = Number((await bell.getAttribute('aria-label'))!.match(/\d+/)![0]);
  expect(before).toBeGreaterThanOrEqual(5);

  await bell.click();
  await expect(page).toHaveURL(/\/notificacoes$/);
  const list = page.getByRole('list', { name: 'Notificações' });
  // A conta vencida da demo vem no topo (N5).
  await expect(list.getByRole('listitem').first()).toContainText('Conta vencida');
  await expect(list).toContainText('Conta de luz');
  await expect(list).toContainText('vence em 2 dias');
  await expect(list).toContainText('Meta concluída: Notebook novo');

  // Critério 4: a ação marca como lida e leva para a tela certa.
  await list.getByRole('listitem').filter({ hasText: 'Meta concluída' }).getByRole('link', { name: 'Ver metas' }).click();
  await expect(page).toHaveURL(/\/planejamento\?aba=metas$/);
  await expect(page.getByRole('link', { name: `Notificações, ${before - 1} ${before - 1 === 1 ? 'não lida' : 'não lidas'}` })).toBeVisible();

  await page.goto('/notificacoes');
  await page.getByRole('button', { name: 'Marcar todas como lidas' }).click();
  await expect(page.getByRole('link', { name: 'Notificações', exact: true })).toBeVisible();

  // Critério 5: desligar "Orçamento" no Perfil tira esses avisos.
  await page.goto('/perfil');
  // Espera o PATCH terminar antes de navegar: a navegação poderia cortar o salvamento.
  const saved = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith('/me'));
  await page.getByRole('region', { name: 'Notificações' }).getByRole('checkbox', { name: /Orçamento/ }).uncheck();
  expect((await saved).ok()).toBe(true);
  await page.goto('/notificacoes');
  await expect(page.getByRole('list', { name: 'Notificações' })).not.toContainText('limite');
});
