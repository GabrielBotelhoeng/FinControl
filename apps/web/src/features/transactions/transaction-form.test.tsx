import type { TransactionDTO } from '@fincontrol/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeApi } from '../../test/fakes';
import { renderApp } from '../../test/render';
import { TransactionForm } from './transaction-form';

const checking = {
  id: 'a1', name: 'Nubank', type: 'checking', color: '#6366F1', initialBalance: 0, balance: 500000,
  archivedAt: null, createdAt: '2026-01-01T00:00:00Z', creditLimit: null, closingDay: null, dueDay: null,
  paymentAccountId: null, card: null,
};

/** Fechamento dia 26, vencimento dia 5 — mesma configuração de cardAccount em accounts-page.test.tsx. */
const card = {
  id: 'c1', name: 'Cartão principal', type: 'credit_card', color: '#7c3aed', initialBalance: 0, balance: -30000,
  archivedAt: null, createdAt: '2026-01-01T00:00:00Z', creditLimit: 800000, closingDay: 26, dueDay: 5,
  paymentAccountId: 'a1', card: { limitAvailable: 770000, openInvoice: null, nextDue: null },
};

const category = { id: 'cat1', name: 'Compras', type: 'expense', icon: 'shopping-bag', color: '#64748B' };

const baseTx: TransactionDTO = {
  id: 't0', type: 'expense', amount: 5000, description: 'Mercado', accountId: 'a1', destinationAccountId: null,
  categoryId: 'cat1', nature: 'variable', status: 'paid', dueDate: '2026-11-10', paidDate: '2026-11-10',
  recurrenceId: null, occurrenceDate: null, invoiceMonth: null, installmentNumber: null, installmentTotal: null,
  overdue: false, createdAt: '2026-11-10T00:00:00Z',
};

function api(over: Record<string, unknown> = {}) {
  return fakeApi({
    'GET /accounts': [checking, card],
    'GET /categories': [category],
    'POST /transactions': (_p: string, body: unknown) => ({ ...baseTx, id: 't1', ...(body as object) }),
    ...over,
  });
}

async function openWithCardSelected(client = api()) {
  const utils = renderApp(<TransactionForm open onOpenChange={() => {}} />, { api: client });
  const dialog = await screen.findByRole('dialog');
  // Espera as contas carregarem (GET /accounts é assíncrono) antes de selecionar — senão a opção ainda não existe.
  await within(dialog).findByRole('option', { name: 'Cartão principal' });
  await userEvent.selectOptions(within(dialog).getByLabelText('Conta'), 'c1');
  return { ...utils, dialog };
}

describe('TransactionForm — compra no cartão (Tarefa 11)', () => {
  it('sem cartão selecionado, não mostra "Parcelar em"', async () => {
    renderApp(<TransactionForm open onOpenChange={() => {}} />, { api: api() });
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText('Parcelar em')).not.toBeInTheDocument();
  });

  it('com um cartão selecionado aparece "Parcelar em" de 1x a 48x', async () => {
    const { dialog } = await openWithCardSelected();
    const select = within(dialog).getByLabelText('Parcelar em');
    expect(within(select).getAllByRole('option')).toHaveLength(48);
    expect(within(select).getByRole('option', { name: '1x' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: '48x' })).toBeInTheDocument();
  });

  it('com cartão selecionado, esconde "Já está pago" e "Repetir" e renomeia a data para "Data da compra"', async () => {
    const { dialog } = await openWithCardSelected();
    expect(within(dialog).queryByText('Já está pago')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Repetir este lançamento')).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText('Data da compra')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Vencimento')).not.toBeInTheDocument();
  });

  it('parcelas iguais: prévia "10x de R$ 120,00 · primeira fatura: dez/2026"', async () => {
    const { dialog } = await openWithCardSelected();
    await userEvent.type(within(dialog).getByLabelText('Valor'), '120000');
    fireEvent.change(within(dialog).getByLabelText('Data da compra'), { target: { value: '2026-11-15' } });
    await userEvent.selectOptions(within(dialog).getByLabelText('Parcelar em'), '10x');
    expect(within(dialog).getByText('10x de R$ 120,00 · primeira fatura: dez/2026')).toBeInTheDocument();
  });

  it('parcelas diferentes: prévia "1ª de R$ 333,34 + 2x de R$ 333,33 · primeira fatura: dez/2026"', async () => {
    const { dialog } = await openWithCardSelected();
    await userEvent.type(within(dialog).getByLabelText('Valor'), '100000');
    fireEvent.change(within(dialog).getByLabelText('Data da compra'), { target: { value: '2026-11-15' } });
    await userEvent.selectOptions(within(dialog).getByLabelText('Parcelar em'), '3x');
    expect(within(dialog).getByText('1ª de R$ 333,34 + 2x de R$ 333,33 · primeira fatura: dez/2026')).toBeInTheDocument();
  });

  it('em 1x não envia installments; acima de 1x envia o número de parcelas', async () => {
    const client = api();
    const { dialog } = await openWithCardSelected(client);
    await userEvent.type(within(dialog).getByLabelText('Valor'), '120000');
    await userEvent.type(within(dialog).getByLabelText('Descrição'), 'Notebook');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar lançamento' }));
    expect(client.post).toHaveBeenCalledWith('/transactions', expect.objectContaining({ accountId: 'c1' }));
    const [, sentBody] = client.post.mock.calls.at(-1) as [string, Record<string, unknown>];
    expect(sentBody).not.toHaveProperty('installments');
  });

  it('em 10x, envia installments: 10', async () => {
    const client = api();
    const { dialog } = await openWithCardSelected(client);
    await userEvent.type(within(dialog).getByLabelText('Valor'), '120000');
    await userEvent.type(within(dialog).getByLabelText('Descrição'), 'Notebook');
    await userEvent.selectOptions(within(dialog).getByLabelText('Parcelar em'), '10x');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar lançamento' }));
    expect(client.post).toHaveBeenCalledWith('/transactions', expect.objectContaining({ installments: 10 }));
  });

  it('ao editar um lançamento de cartão, conta e data ficam travadas e não mostra "Parcelar em"', async () => {
    const tx = { ...baseTx, id: 't1', accountId: 'c1', invoiceMonth: '2026-12', installmentNumber: 3, installmentTotal: 10 };
    renderApp(<TransactionForm open onOpenChange={() => {}} transaction={tx} />, { api: api() });
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('option', { name: 'Cartão principal' });
    expect(within(dialog).getByLabelText('Conta')).toBeDisabled();
    expect(within(dialog).getByLabelText('Data da compra')).toBeDisabled();
    expect(within(dialog).queryByLabelText('Parcelar em')).not.toBeInTheDocument();
  });
});
