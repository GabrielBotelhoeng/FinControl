import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeApi } from '../../test/fakes';
import { renderApp } from '../../test/render';
import ImportPage, { readStatementFile } from './import-page';

const accounts = [
  {
    id: 'a1', name: 'Corrente', type: 'checking', color: '#2563eb', initialBalance: 0, balance: 0, archivedAt: null,
    createdAt: '', creditLimit: null, closingDay: null, dueDay: null, paymentAccountId: null, card: null,
  },
];
const categories = [
  { id: 'food', name: 'Alimentação', type: 'expense', icon: 'utensils', color: '#000' },
  { id: 'other', name: 'Outros', type: 'expense', icon: 'tag', color: '#000' },
  { id: 'salary', name: 'Salário', type: 'income', icon: 'briefcase', color: '#000' },
];
const csv = 'Data;Valor;Descrição\n05/11/2026;-45,90;Padaria\n05/11/2026;-12,00;Repetida\n10/11/2026;3.000,00;Salário';

describe('ImportPage', () => {
  it('lê o CSV, mostra as sugestões, deixa o repetido desmarcado e importa só o marcado', async () => {
    const client = fakeApi({
      'GET /accounts': accounts,
      'GET /categories': categories,
      'POST /imports/preview': (_path: string, body: { rows: { description: string }[] }) => ({
        rows: [
          { date: '2026-11-05', description: body.rows[0]!.description, amount: 4590, type: 'expense', categoryId: 'food', suggestion: 'keyword', duplicate: false, transferLike: false },
          { date: '2026-11-05', description: 'Repetida', amount: 1200, type: 'expense', categoryId: 'other', suggestion: 'fallback', duplicate: true, transferLike: false },
          { date: '2026-11-10', description: 'Salário', amount: 300000, type: 'income', categoryId: 'salary', suggestion: 'history', duplicate: false, transferLike: false },
        ],
      }),
      'POST /imports/commit': { created: 2 },
    });
    renderApp(<ImportPage />, { api: client, extraRoutes: { '/lancamentos': <p>Lançamentos</p> } });
    const input = await screen.findByLabelText('Arquivo OFX ou CSV');
    await screen.findByRole('option', { name: 'Corrente' });
    await userEvent.upload(input, new File([csv], 'extrato.csv', { type: 'text/csv' }));

    const region = await screen.findByRole('region', { name: 'Lançamentos do extrato' });
    expect(region).toHaveTextContent('3 lançamentos no arquivo');
    expect(region).toHaveTextContent('Parece repetido');
    expect(within(region).getByRole('checkbox', { name: /Repetida/ })).not.toBeChecked();
    expect(client.post).toHaveBeenCalledWith('/imports/preview', {
      accountId: 'a1',
      rows: [
        { date: '2026-11-05', description: 'Padaria', amount: -4590 },
        { date: '2026-11-05', description: 'Repetida', amount: -1200 },
        { date: '2026-11-10', description: 'Salário', amount: 300000 },
      ],
    });

    await userEvent.click(within(region).getByRole('button', { name: 'Importar 2 lançamentos' }));
    expect(client.post).toHaveBeenCalledWith('/imports/commit', {
      accountId: 'a1',
      rows: [
        { date: '2026-11-05', description: 'Padaria', amount: -4590, categoryId: 'food' },
        { date: '2026-11-10', description: 'Salário', amount: 300000, categoryId: 'salary' },
      ],
    });
    expect(await screen.findByText('Lançamentos')).toBeInTheDocument();
  });

  it('arquivo sem as colunas certas explica o problema', async () => {
    renderApp(<ImportPage />, { api: fakeApi({ 'GET /accounts': accounts, 'GET /categories': categories }) });
    const input = await screen.findByLabelText('Arquivo OFX ou CSV');
    await screen.findByRole('option', { name: 'Corrente' });
    await userEvent.upload(input, new File(['Nome;Quantia\nx;1'], 'x.csv', { type: 'text/csv' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('O cabeçalho precisa ter "Data" e "Valor".');
  });

  it('lê OFX em Windows-1252 (acentos certos)', async () => {
    const bytes = new Uint8Array([...new TextEncoder().encode('<MEMO>PADARIA S'), 0xe3, 0x4f]); // "SãO" em Windows-1252
    expect(await readStatementFile(new File([bytes], 'x.ofx'))).toBe('<MEMO>PADARIA SãO');
  });
});
