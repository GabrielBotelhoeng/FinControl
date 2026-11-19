import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { TagInput } from '../../components/ui/tag-input';
import { fakeApi } from '../../test/fakes';
import { renderApp } from '../../test/render';
import TransactionsPage from '../transactions/transactions-page';
import { TagsSection } from './tags-section';

const account = {
  id: 'a1', name: 'Nubank', type: 'checking', color: '#6366F1', initialBalance: 0, balance: 500000, archivedAt: null,
  createdAt: '2026-01-01T00:00:00Z', creditLimit: null, closingDay: null, dueDay: null, paymentAccountId: null, card: null,
};
const category = { id: 'c1', name: 'Alimentação', type: 'expense', icon: 'utensils', color: '#64748B' };
const tx = {
  id: 't1', type: 'expense', amount: 3000, description: 'Cerveja', accountId: 'a1', destinationAccountId: null, categoryId: 'c1',
  nature: 'variable', status: 'paid', dueDate: '2026-11-05', paidDate: '2026-11-05', recurrenceId: null, occurrenceDate: null,
  invoiceMonth: null, installmentNumber: null, installmentTotal: null, loanId: null, tags: ['bebida'], overdue: false, createdAt: '',
};

function TagInputHarness() {
  const [tags, setTags] = useState<string[]>([]);
  return (
    <label>
      Tags
      <TagInput value={tags} onChange={setTags} suggestions={['bebida']} />
    </label>
  );
}

describe('tags (sub-projeto 13)', () => {
  it('campo de tags: Enter e vírgula adicionam a tag normalizada, sem repetir; o "x" remove; inválida avisa (T2, T7)', async () => {
    renderApp(<TagInputHarness />);
    const input = screen.getByRole('combobox', { name: 'Tags' });
    await userEvent.type(input, '#Bebida{Enter}');
    await userEvent.type(input, 'Bar,');
    await userEvent.type(input, 'bebida{Enter}');
    expect(screen.getByRole('list', { name: 'Tags escolhidas' })).toHaveTextContent('#bar#bebida');
    await userEvent.click(screen.getByRole('button', { name: 'Remover a tag bar' }));
    expect(screen.getByRole('list', { name: 'Tags escolhidas' })).toHaveTextContent('#bebida');
    await userEvent.type(input, 'bar/balada{Enter}');
    expect(screen.getByText('Use só letras, números, espaço, hífen ou sublinhado')).toBeInTheDocument();
    // O texto inválido fica no campo para a pessoa corrigir, e o aviso some quando ela edita.
    expect(input).toHaveValue('bar/balada');
    await userEvent.type(input, '{Backspace}'.repeat(7));
    expect(screen.queryByText('Use só letras, números, espaço, hífen ou sublinhado')).not.toBeInTheDocument();
    await userEvent.type(input, '{Enter}');
    expect(screen.getByRole('list', { name: 'Tags escolhidas' })).toHaveTextContent('#bar#bebida');
    expect(input).toHaveValue('');
  });

  it('Lançamentos: o filtro por tag sem resultado pede para limpar os filtros, e o seletor fica enquanto a tag estiver escolhida (T5)', async () => {
    let tagRows = [{ name: 'bebida', count: 1 }];
    const client = fakeApi({
      'GET /transactions': (_p: string, _b: unknown, query: unknown) => ({ items: (query as { tag?: string }).tag ? [] : [tx], nextCursor: null }),
      'GET /accounts': [account],
      'GET /categories': [category],
      'GET /tags': () => tagRows,
    });
    const { queryClient } = renderApp(<TransactionsPage />, { api: client, route: '/lancamentos', path: '/lancamentos' });
    await screen.findByRole('listitem', { name: 'Cerveja' });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tag' }), 'bebida');
    expect(await screen.findByText('Nada encontrado com esses filtros')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lançar agora' })).not.toBeInTheDocument();

    // A tag saiu do último lançamento (por exemplo, numa edição): o seletor continua, com ela escolhida.
    tagRows = [];
    await act(() => queryClient.invalidateQueries({ queryKey: ['tags'] }));
    expect(screen.getByRole('combobox', { name: 'Tag' })).toHaveValue('bebida');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tag' }), '');
    expect(await screen.findByRole('listitem', { name: 'Cerveja' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Tag' })).not.toBeInTheDocument();
  });

  it('Lançamentos: a linha mostra as tags, o filtro manda a tag e o novo lançamento envia as tags (T5, T7, T8)', async () => {
    const client = fakeApi({
      'GET /transactions': { items: [tx], nextCursor: null },
      'GET /accounts': [account],
      'GET /categories': [category],
      'GET /tags': [{ name: 'bebida', count: 1 }],
      'POST /transactions': (_p: string, body: unknown) => ({ ...tx, ...(body as object), id: 't2' }),
    });
    renderApp(<TransactionsPage />, { api: client, route: '/lancamentos', path: '/lancamentos' });
    expect(await screen.findByRole('listitem', { name: 'Cerveja' })).toHaveTextContent('#bebida');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tag' }), 'bebida');
    await waitFor(() => expect(client.get).toHaveBeenCalledWith('/transactions', expect.objectContaining({ tag: 'bebida' })));

    await userEvent.click(screen.getAllByRole('button', { name: 'Novo lançamento' })[0]!);
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Valor'), '2500');
    await userEvent.type(within(dialog).getByLabelText('Descrição'), 'Chopp');
    await userEvent.type(within(dialog).getByLabelText('Tags (opcional)'), 'Bebida{Enter}');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar lançamento' }));
    await waitFor(() => expect(client.post).toHaveBeenCalledWith('/transactions', expect.objectContaining({ description: 'Chopp', tags: ['bebida'] })));
  });

  it('Categorias → Tags: lista com a quantidade, renomeia e exclui com confirmação (T6)', async () => {
    const client = fakeApi({
      'GET /tags': [{ name: 'bebida', count: 2 }, { name: 'cerva', count: 1 }],
      'PATCH /tags/cerva': { name: 'bebida', count: 3 },
      'DELETE /tags/bebida': undefined,
    });
    renderApp(<TagsSection />, { api: client });
    const cerva = await screen.findByRole('listitem', { name: '#cerva' });
    expect(cerva).toHaveTextContent('1 lançamento');
    await userEvent.click(within(cerva).getByRole('button', { name: 'Renomear' }));
    const name = within(cerva).getByRole('textbox', { name: 'Novo nome da tag cerva' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Bebida');
    await userEvent.click(within(cerva).getByRole('button', { name: 'Salvar' }));
    expect(client.patch).toHaveBeenCalledWith('/tags/cerva', { name: 'Bebida' });

    const bebida = screen.getByRole('listitem', { name: '#bebida' });
    await userEvent.click(within(bebida).getByRole('button', { name: 'Excluir' }));
    expect(bebida).toHaveTextContent('os lançamentos continuam');
    await userEvent.click(within(bebida).getByRole('button', { name: 'Confirmar' }));
    expect(client.del).toHaveBeenCalledWith('/tags/bebida');
  });

  it('Categorias → Tags: nome inválido avisa sem chamar a API, e "Cancelar" volta ao nome atual (T2, T6)', async () => {
    const client = fakeApi({ 'GET /tags': [{ name: 'cerva', count: 1 }] });
    renderApp(<TagsSection />, { api: client });
    const cerva = await screen.findByRole('listitem', { name: '#cerva' });
    await userEvent.click(within(cerva).getByRole('button', { name: 'Renomear' }));
    const name = within(cerva).getByRole('textbox', { name: 'Novo nome da tag cerva' });
    await userEvent.clear(name);
    await userEvent.type(name, 'bar/balada');
    await userEvent.click(within(cerva).getByRole('button', { name: 'Salvar' }));
    expect(within(cerva).getByText('Use só letras, números, espaço, hífen ou sublinhado')).toBeInTheDocument();
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(client.patch).not.toHaveBeenCalled();

    await userEvent.click(within(cerva).getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(within(cerva).getByRole('button', { name: 'Renomear' }));
    expect(within(cerva).getByRole('textbox', { name: 'Novo nome da tag cerva' })).toHaveValue('cerva');
    expect(within(cerva).queryByText('Use só letras, números, espaço, hífen ou sublinhado')).not.toBeInTheDocument();
  });
});
