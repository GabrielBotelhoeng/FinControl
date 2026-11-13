import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeApi } from '../../test/fakes';
import { renderApp } from '../../test/render';
import InvoicesPage from './invoices-page';

const checking = {
  id: 'a1', name: 'Nubank', type: 'checking', color: '#6366F1', initialBalance: 0, balance: 500000,
  archivedAt: null, createdAt: '', creditLimit: null, closingDay: null, dueDay: null, paymentAccountId: null, card: null,
};

const secondChecking = {
  id: 'a2', name: 'Inter', type: 'checking', color: '#FF7A00', initialBalance: 0, balance: 200000,
  archivedAt: null, createdAt: '', creditLimit: null, closingDay: null, dueDay: null, paymentAccountId: null, card: null,
};

function cardAccount(over: Record<string, unknown> = {}) {
  return {
    id: 'c1', name: 'Cartão principal', type: 'credit_card', color: '#7c3aed', initialBalance: 0, balance: -30000,
    archivedAt: null, createdAt: '', creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountId: 'a1',
    card: { limitAvailable: 770000, openInvoice: { month: '2026-12', amount: 30000 }, nextDue: { date: '2026-12-05', amount: 30000 } },
    ...over,
  };
}

const invoiceList = [
  { month: '2026-12', closingDate: '2026-11-26', dueDate: '2026-12-05', amount: 30000, paid: 0, status: 'open' },
  { month: '2026-11', closingDate: '2026-10-26', dueDate: '2026-11-05', amount: 45000, paid: 45000, status: 'paid' },
  { month: '2026-10', closingDate: '2026-09-26', dueDate: '2026-10-05', amount: 12000, paid: 0, status: 'overdue' },
  { month: '2026-09', closingDate: '2026-08-26', dueDate: '2026-09-05', amount: 8000, paid: 0, status: 'closed' },
];

function api(over: Record<string, unknown> = {}) {
  return fakeApi({
    'GET /accounts': [checking, cardAccount()],
    'GET /cards/c1/invoices': invoiceList,
    'GET /cards/c1/invoices/2026-12': { ...invoiceList[0], transactions: [] },
    ...over,
  });
}

function renderPage(client = api()) {
  return renderApp(<InvoicesPage />, { route: '/cartoes/c1', path: '/cartoes/:id', api: client });
}

describe('InvoicesPage', () => {
  it('mostra o nome do cartão e o resumo do limite', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: /Cartão principal/ })).toBeInTheDocument();
    expect(screen.getByText(/Dispon[íi]vel/)).toHaveTextContent('7.700,00');
  });

  it('lista as faturas com situação escrita e ícone: Aberta, Paga, Vencida, Fechada', async () => {
    renderPage();
    await screen.findByRole('heading', { name: /Cartão principal/ });
    expect(screen.getByText('Aberta')).toBeInTheDocument();
    expect(screen.getByText('Paga')).toBeInTheDocument();
    expect(screen.getByText('Vencida')).toBeInTheDocument();
    expect(screen.getByText('Fechada')).toBeInTheDocument();
  });

  it('a fatura aberta aparece em destaque e as demais em "Fechadas e histórico"', async () => {
    renderPage();
    await screen.findByRole('heading', { name: /Cartão principal/ });
    expect(screen.getByRole('region', { name: 'Fatura aberta' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fechadas e histórico' })).toBeInTheDocument();
  });

  it('a fatura aberta mostra os lançamentos sem precisar expandir', async () => {
    const client = api({
      'GET /cards/c1/invoices/2026-12': {
        ...invoiceList[0],
        transactions: [
          { id: 't1', type: 'expense', amount: 30000, description: 'Mercado', accountId: 'c1', destinationAccountId: null, categoryId: null, nature: 'variable', status: 'paid', dueDate: '2026-11-20', paidDate: '2026-11-20', recurrenceId: null, occurrenceDate: null, invoiceMonth: '2026-12', installmentNumber: null, installmentTotal: null, overdue: false, createdAt: '' },
        ],
      },
    });
    renderApp(<InvoicesPage />, { route: '/cartoes/c1', path: '/cartoes/:id', api: client });
    const openSection = await screen.findByRole('region', { name: 'Fatura aberta' });
    expect(await within(openSection).findByText('Mercado')).toBeInTheDocument();
  });

  it('"Pagar fatura" aparece só quando o restante (valor − pago) é maior que zero', async () => {
    renderPage();
    await screen.findByRole('heading', { name: /Cartão principal/ });
    // 4 faturas, 1 já paga (paid === amount) → 3 com o botão "Pagar fatura".
    expect(screen.getAllByRole('button', { name: 'Pagar fatura' })).toHaveLength(3);
  });

  it('cartão inexistente ou de outro usuário mostra o estado de erro no padrão da app', async () => {
    renderPage(api({ 'GET /accounts': [checking], 'GET /cards/c1/invoices': new Error('Cartão não encontrado(a).') }));
    expect(await screen.findByText('Cartão não encontrado(a).')).toBeInTheDocument();
  });

  it('abre o diálogo de pagamento com o valor restante e a conta pagadora padrão, e envia o pagamento', async () => {
    const client = api();
    renderApp(<InvoicesPage />, { route: '/cartoes/c1', path: '/cartoes/:id', api: client });
    await screen.findByRole('heading', { name: /Cartão principal/ });
    const openSection = screen.getByRole('region', { name: 'Fatura aberta' });
    await userEvent.click(within(openSection).getByRole('button', { name: 'Pagar fatura' }));

    const dialog = await screen.findByRole('dialog', { name: 'Pagar fatura' });
    expect(within(dialog).getByLabelText('Valor')).toHaveValue('300,00');
    expect(within(dialog).getByLabelText('Conta pagadora')).toHaveValue('a1');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Pagar fatura' }));
    expect(client.post).toHaveBeenCalledWith('/cards/c1/invoices/2026-12/payments', { amount: 30000, accountId: 'a1', paidDate: expect.any(String) });
  });

  it('diálogo com conta padrão quando paymentAccountId é null (decisão do controlador)', async () => {
    const client = fakeApi({
      'GET /accounts': [secondChecking, checking, cardAccount({ paymentAccountId: null })],
      'GET /cards/c1/invoices': invoiceList,
      'GET /cards/c1/invoices/2026-12': { ...invoiceList[0], transactions: [] },
    });
    renderApp(<InvoicesPage />, { route: '/cartoes/c1', path: '/cartoes/:id', api: client });
    await screen.findByRole('heading', { name: /Cartão principal/ });
    const openSection = screen.getByRole('region', { name: 'Fatura aberta' });
    await userEvent.click(within(openSection).getByRole('button', { name: 'Pagar fatura' }));
    const dialog = await screen.findByRole('dialog', { name: 'Pagar fatura' });
    // Sem paymentAccountId, a padrão é a 1ª conta ativa elegível (a2, que vem primeiro na lista).
    expect(within(dialog).getByLabelText('Conta pagadora')).toHaveValue('a2');
  });
});
