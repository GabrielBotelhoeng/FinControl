import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { enterDemo } from './helpers';

test('relatórios da demo: resumo, categorias, tags, dívidas e os downloads em CSV, Excel e PDF', async ({ page }) => {
  await enterDemo(page);
  // O painel mostra o total de dívidas da demo (cartão e financiamento) e leva aos relatórios.
  const debts = page.getByRole('region', { name: 'Total de dívidas' });
  await expect(debts).toContainText(/Cartões R\$\s[\d.]+,\d{2} · Empréstimos R\$\s[\d.]+,\d{2}/);
  await debts.getByRole('link', { name: 'Ver relatórios' }).click();
  await expect(page).toHaveURL(/\/relatorios$/);

  const summary = page.getByRole('region', { name: 'Resumo do período' });
  await expect(summary.getByRole('group', { name: 'Receitas' })).toContainText(/R\$\s[\d.]+,\d{2}/);
  await expect(page.getByRole('list', { name: 'Gastos por categoria' }).getByRole('listitem').first()).toBeVisible();
  // Sub-projeto 14 (H4): a tag da demo junta restaurante, cinema e lazer.
  await expect(page.getByRole('list', { name: 'Gastos por tag' }).getByRole('listitem', { name: '#passeios' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Evolução das dívidas' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Saldo das contas' })).toContainText('Total');

  await page.getByRole('radio', { name: '12 meses' }).click();
  await expect(page.getByText(/^[a-z]{3}\/\d{4} a [a-z]{3}\/\d{4}$/)).toBeVisible();

  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar CSV' }).click();
  const csv = await csvDownload;
  expect(csv.suggestedFilename()).toMatch(/^fincontrol-lancamentos-\d{4}-\d{2}_\d{4}-\d{2}\.csv$/);
  const text = await readFile((await csv.path())!, 'utf-8');
  expect(text.startsWith('\uFEFFData;Descrição;Tipo;Categoria;Conta;Conta de destino;Situação;Valor;Tags\r\n')).toBe(true);
  expect(text.split('\r\n').length).toBeGreaterThan(20);

  const xlsxDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar Excel' }).click();
  const xlsx = await xlsxDownload;
  expect(xlsx.suggestedFilename()).toMatch(/^fincontrol-analise-\d{4}-\d{2}_\d{4}-\d{2}\.xlsx$/);
  // O conteúdo de cada aba é conferido no teste da API; aqui, que o arquivo baixado é um .xlsx (zip, "PK").
  const xlsxBytes = await readFile((await xlsx.path())!);
  expect(xlsxBytes.subarray(0, 2).toString('latin1')).toBe('PK');
  if (process.env.XLSX_OUT) await xlsx.saveAs(process.env.XLSX_OUT);

  const pdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar PDF' }).click();
  const pdf = await pdfDownload;
  expect(pdf.suggestedFilename()).toMatch(/^fincontrol-relatorio-\d{4}-\d{2}_\d{4}-\d{2}\.pdf$/);
  const bytes = await readFile((await pdf.path())!);
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
});
