import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api-client';
import { fakeApi } from '../../test/fakes';
import { renderApp } from '../../test/render';
import TransactionsPage from '../transactions/transactions-page';
import CategoriesPage from './categories-page';

const cat = (id: string, name: string, parentId: string | null = null) => ({ id, name, type: 'expense', icon: 'party-popper', color: '#EC4899', parentId });
const categories = [cat('c1', 'Lazer'), cat('c2', 'Outros'), cat('s1', 'Bar', 'c1'), cat('c3', 'Alimentação'), cat('s2', 'Restaurante', 'c3')];

describe('subcategorias (sub-projeto 15)', () => {
  it('U1 e U2: as subcategorias ficam embaixo da categoria; criar e renomear mandam só o nome', async () => {
    const api = fakeApi({
      'GET /categories': categories,
      'POST /categories/c1/subcategories': (_p: string, body: unknown) => ({ ...cat('s3', 'Cinema', 'c1'), ...(body as object) }),
      'PATCH /categories/s1': (_p: string, body: unknown) => ({ ...cat('s1', 'Bar', 'c1'), ...(body as object) }),
    });
    renderApp(<CategoriesPage />, { api });
    expect(within(await screen.findByRole('list', { name: 'Subcategorias de Lazer' })).getByText('Bar')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Nova subcategoria em Lazer' }));
    let dialog = await screen.findByRole('dialog', { name: 'Nova subcategoria em Lazer' });
    // Sem nome, avisa; o aviso some quando a pessoa digita (CodeRabbit).
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    expect(within(dialog).getByText('Dê um nome para a subcategoria.')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Cinema');
    expect(within(dialog).queryByText('Dê um nome para a subcategoria.')).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    expect(api.post).toHaveBeenCalledWith('/categories/c1/subcategories', { name: 'Cinema' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Renomear Bar' }));
    dialog = await screen.findByRole('dialog', { name: 'Renomear subcategoria' });
    const name = within(dialog).getByLabelText('Nome');
    await userEvent.clear(name);
    await userEvent.type(name, 'Bares');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    expect(api.patch).toHaveBeenCalledWith('/categories/s1', { name: 'Bares' });
  });

  it('U9: a subcategoria em uso sugere a própria categoria como destino', async () => {
    let calls = 0;
    const api = fakeApi({
      'GET /categories': categories,
      'DELETE /categories/s1': () => (calls++ === 0 ? new ApiError(409, 'Conflito', 'A categoria está em uso.') : undefined),
    });
    renderApp(<CategoriesPage />, { api });
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Bar' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    expect(await within(dialog).findByRole('combobox', { name: 'Mover os lançamentos para' })).toHaveValue('c1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mover e excluir' }));
    expect(api.del).toHaveBeenLastCalledWith('/categories/s1?reassignTo=c1');
  });

  it('U9: excluir a categoria avisa que as subcategorias vão junto e não as oferece como destino', async () => {
    const api = fakeApi({ 'GET /categories': categories, 'DELETE /categories/c1': () => new ApiError(409, 'Conflito', 'A categoria está em uso.') });
    renderApp(<CategoriesPage />, { api });
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Lazer' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('note')).toHaveTextContent('As subcategorias “Bar” também serão excluídas.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    const select = await within(dialog).findByRole('combobox', { name: 'Mover os lançamentos para' });
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Alimentação', 'Alimentação › Restaurante', 'Outros']);
  });

  it('U4: a linha mostra "Categoria › Subcategoria" e o formulário oferece as subcategorias embaixo da categoria', async () => {
    const account = {
      id: 'a1', name: 'Nubank', type: 'checking', color: '#6366F1', initialBalance: 0, balance: 0, archivedAt: null,
      createdAt: '2026-01-01T00:00:00Z', creditLimit: null, closingDay: null, dueDay: null, paymentAccountId: null, card: null,
    };
    const tx = {
      id: 't1', type: 'expense', amount: 3000, description: 'Pizza', accountId: 'a1', destinationAccountId: null, categoryId: 's2',
      nature: 'variable', status: 'paid', dueDate: '2026-11-05', paidDate: '2026-11-05', recurrenceId: null, occurrenceDate: null,
      invoiceMonth: null, installmentNumber: null, installmentTotal: null, loanId: null, tags: [], overdue: false, createdAt: '',
    };
    const api = fakeApi({
      'GET /transactions': { items: [tx], nextCursor: null },
      'GET /accounts': [account],
      'GET /categories': categories,
      'GET /tags': [],
    });
    renderApp(<TransactionsPage />, { api, route: '/lancamentos', path: '/lancamentos' });
    expect(await screen.findByRole('listitem', { name: 'Pizza' })).toHaveTextContent('Alimentação › Restaurante · Nubank');
    await userEvent.click(screen.getAllByRole('button', { name: 'Novo lançamento' })[0]!);
    const dialog = await screen.findByRole('dialog');
    const select = within(dialog).getByLabelText('Categoria');
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Alimentação', 'Alimentação › Restaurante', 'Lazer', 'Lazer › Bar', 'Outros',
    ]);
    expect(select).toHaveValue('c3');
  });
});
