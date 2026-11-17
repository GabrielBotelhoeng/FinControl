import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api-client';
import { fakeApi } from '../../test/fakes';
import { renderApp } from '../../test/render';
import CategoriesPage from './categories-page';

const categories = [
  { id: 'c1', name: 'Lazer', type: 'expense', icon: 'party-popper', color: '#EC4899' },
  { id: 'c2', name: 'Outros', type: 'expense', icon: 'circle-ellipsis', color: '#64748B' },
  { id: 'c3', name: 'Salário', type: 'income', icon: 'briefcase', color: '#14B8A6' },
];

describe('CategoriesPage', () => {
  it('separa despesas e receitas em abas', async () => {
    renderApp(<CategoriesPage />, { api: fakeApi({ 'GET /categories': categories }) });
    expect(await screen.findByText('Lazer')).toBeInTheDocument();
    expect(screen.queryByText('Salário')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Receitas' }));
    expect(screen.getByText('Salário')).toBeInTheDocument();
  });

  it('excluir categoria em uso abre a reatribuição e envia reassignTo', async () => {
    let calls = 0;
    const api = fakeApi({
      'GET /categories': categories,
      'DELETE /categories/c1': () => (calls++ === 0 ? new ApiError(409, 'Conflito', 'A categoria está em uso.') : undefined),
    });
    renderApp(<CategoriesPage />, { api });
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Lazer' }));
    const dialog = await screen.findByRole('dialog', { name: 'Excluir “Lazer”' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    const reassign = await within(dialog).findByLabelText('Mover os lançamentos para');
    expect(within(reassign).queryByRole('option', { name: 'Lazer' })).not.toBeInTheDocument();
    await userEvent.selectOptions(reassign, 'c2');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mover e excluir' }));
    expect(api.del).toHaveBeenLastCalledWith('/categories/c1?reassignTo=c2');
  });

  it('R13 (a): o diálogo avisa o que acontece com o limite ao juntar as categorias', async () => {
    const budgetItem = (categoryId: string, limit: number) => ({ categoryId, name: categoryId, icon: 'x', color: '#000', limit, paid: 0, pending: 0, committed: 0, percent: 0, status: 'ok', suggested: null });
    let items = [budgetItem('c1', 30000)];
    const api = fakeApi({
      'GET /categories': categories,
      'GET /budgets': () => ({ items, categoriesWithoutBudget: [] }),
      'DELETE /categories/c1': () => new ApiError(409, 'Conflito', 'A categoria está em uso.'),
    });
    const open = async () => {
      await userEvent.click(await screen.findByRole('button', { name: 'Excluir Lazer' }));
      const dialog = await screen.findByRole('dialog', { name: 'Excluir “Lazer”' });
      await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }));
      return dialog;
    };
    const { unmount } = renderApp(<CategoriesPage />, { api });
    expect(await within(await open()).findByRole('note')).toHaveTextContent(/O limite de R\$\s*300,00 de “Lazer” passa para “Outros”/);
    unmount();

    items = [budgetItem('c1', 30000), budgetItem('c2', 80000)];
    renderApp(<CategoriesPage />, { api });
    expect(await within(await open()).findByRole('note')).toHaveTextContent(/“Outros” já tem limite de R\$\s*800,00 e fica com ele/);
  });
});
