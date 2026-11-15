import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeApi } from '../../test/fakes';
import { renderApp } from '../../test/render';
import TransactionsPage from './transactions-page';

const base = {
  type: 'expense', amount: 11990, description: 'Internet', accountId: 'a1', destinationAccountId: null, categoryId: 'c1',
  nature: 'fixed', status: 'pending', dueDate: '2026-11-15', paidDate: null, recurrenceId: null, occurrenceDate: null,
  overdue: false, createdAt: '2026-11-01T00:00:00Z',
};

function api(item: Record<string, unknown>) {
  return fakeApi({
    'GET /transactions': { items: [{ ...base, id: 't1', ...item }], nextCursor: null },
    'GET /accounts': [{ id: 'a1', name: 'Nubank', type: 'checking', color: '#6366F1', initialBalance: 0, balance: 0, archivedAt: null, createdAt: '' }],
    'GET /categories': [{ id: 'c1', name: 'Contas', type: 'expense', icon: 'receipt', color: '#64748B' }],
    'PATCH /transactions/': (_p: string, body: unknown) => ({ ...base, id: 't1', ...(body as object) }),
    'POST /transactions/t1/pay': { ...base, id: 't1', status: 'paid', paidDate: '2026-11-11' },
  });
}

describe('TransactionsPage', () => {
  it('lista com valor sinalizado e marca como pago', async () => {
    const client = api({});
    renderApp(<TransactionsPage />, { api: client });
    const row = await screen.findByRole('listitem', { name: /Internet/ });
    expect(row).toHaveTextContent(/−R\$\s*119,90/);
    await userEvent.click(within(row).getByRole('button', { name: 'Marcar Internet como pago' }));
    expect(client.post).toHaveBeenCalledWith('/transactions/t1/pay', {});
  });

  it('editar lançamento recorrente pergunta o escopo e envia ?scope=future', async () => {
    const client = api({ recurrenceId: 'r1', occurrenceDate: '2026-11-15' });
    renderApp(<TransactionsPage />, { api: client });
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Internet' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar lançamento' });
    const description = within(dialog).getByLabelText('Descrição');
    await userEvent.clear(description);
    await userEvent.type(description, 'Fibra 500MB');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar lançamento' }));
    const scope = await screen.findByRole('dialog', { name: 'Aplicar a alteração em' });
    await userEvent.click(within(scope).getByRole('button', { name: 'Esta e as próximas' }));
    expect(client.patch).toHaveBeenCalledWith('/transactions/t1?scope=future', expect.objectContaining({ description: 'Fibra 500MB' }));
  });

  it('lançamento vencido mostra o selo "Vencido"', async () => {
    renderApp(<TransactionsPage />, { api: api({ overdue: true, dueDate: '2026-11-03' }) });
    expect(await screen.findByText('Vencido')).toBeInTheDocument();
  });

  it('lançamento de cartão não mostra o botão de pagar/desfazer, e a parcela mostra "k/N" (decisão R19, Tarefa 11)', async () => {
    const client = fakeApi({
      'GET /transactions': {
        items: [{ ...base, id: 't1', accountId: 'card1', invoiceMonth: '2026-12', installmentNumber: 3, installmentTotal: 10 }],
        nextCursor: null,
      },
      'GET /accounts': [
        { id: 'a1', name: 'Nubank', type: 'checking', color: '#6366F1', initialBalance: 0, balance: 0, archivedAt: null, createdAt: '' },
        {
          id: 'card1', name: 'Cartão principal', type: 'credit_card', color: '#7c3aed', initialBalance: 0, balance: -30000,
          archivedAt: null, createdAt: '', creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountId: 'a1',
          card: { limitAvailable: 770000, openInvoice: null, nextDue: null },
        },
      ],
      'GET /categories': [{ id: 'c1', name: 'Contas', type: 'expense', icon: 'receipt', color: '#64748B' }],
    });
    renderApp(<TransactionsPage />, { api: client });
    const row = await screen.findByRole('listitem', { name: /Internet/ });
    expect(within(row).queryByRole('button', { name: /pago/ })).not.toBeInTheDocument();
    expect(row).toHaveTextContent('3/10');
  });
});
