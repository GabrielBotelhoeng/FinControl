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
});
