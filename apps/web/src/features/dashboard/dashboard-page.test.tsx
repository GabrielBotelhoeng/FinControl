import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api-client';
import { fakeApi } from '../../test/fakes';
import { renderApp } from '../../test/render';
import DashboardPage from './dashboard-page';

const summary = {
  month: '2026-11',
  totalBalance: 1248050,
  forecastEndOfMonth: 1103010,
  income: { current: 650000, previous: 0, changePercent: null },
  expense: { current: 312040, previous: 278000, changePercent: 12.2 },
  pendingCount: 2,
  overdueCount: 1,
  health: { savingsRate: 0.25, reserveMonths: 4.2, liquidBalance: 420000, averageMonthlyExpense: 100000 },
  upcoming: [
    { kind: 'transaction', id: 't1', type: 'expense', amount: 11990, description: 'Internet', accountId: 'a1', destinationAccountId: null, categoryId: 'c1', nature: 'fixed', status: 'pending', dueDate: '2026-10-15', paidDate: null, recurrenceId: 'r1', occurrenceDate: '2026-10-15', overdue: true, createdAt: '' },
  ],
};

const routes = (over: Record<string, unknown> = {}) => ({
  'GET /dashboard/summary': summary,
  'GET /dashboard/evolution': [{ month: '2026-11', income: 650000, expense: 312040, endBalance: 1248050 }],
  'GET /dashboard/by-category': [{ categoryId: 'c1', name: 'Moradia', icon: 'house', color: '#6366F1', total: 180000 }],
  'GET /accounts': [],
  'GET /categories': [],
  ...over,
});

describe('DashboardPage', () => {
  it('mostra o saldo herói, a previsão, a comparação e "—" sem mês anterior', async () => {
    renderApp(<DashboardPage />, { api: fakeApi(routes()) });
    expect(await screen.findByLabelText('Saldo total')).toHaveTextContent(/R\$\s*12\.480,50/);
    expect(screen.getByText(/Previsão para o fim do mês/)).toHaveTextContent(/11\.030,10/);
    expect(screen.getByLabelText('Variação das receitas')).toHaveTextContent('—');
    expect(screen.getByLabelText('Variação das despesas')).toHaveTextContent('12,2%');
    expect(screen.getByRole('listitem', { name: /Internet/ })).toHaveTextContent('Vencido');
    expect(screen.getByText('Moradia')).toBeInTheDocument();
  });

  it('fatura de cartão aparece em "A pagar" com ícone de cartão, vencimento, valor e situação (Tarefa 8)', async () => {
    const withInvoices = routes({
      'GET /dashboard/summary': {
        ...summary,
        upcoming: [
          { kind: 'invoice', cardId: 'c1', cardName: 'Cartão Nubank', month: '2026-10', dueDate: '2026-10-05', remaining: 45000, status: 'overdue' },
          { kind: 'invoice', cardId: 'c2', cardName: 'Cartão Inter', month: '2026-11', dueDate: '2026-11-20', remaining: 12000, status: 'closed' },
        ],
      },
    });
    renderApp(<DashboardPage />, { api: fakeApi(withInvoices) });

    const overdueRow = await screen.findByRole('listitem', { name: /Fatura do Cartão Nubank/ });
    expect(overdueRow).toHaveTextContent('Vencida');
    expect(overdueRow).toHaveTextContent('450,00');

    const closedRow = screen.getByRole('listitem', { name: /Fatura do Cartão Inter/ });
    expect(closedRow).toHaveTextContent('Fechada');
    expect(closedRow).toHaveTextContent('120,00');
  });

  it('API fora do ar mostra o estado de erro e "Tentar de novo" refaz a busca', async () => {
    let fail = true;
    const api = fakeApi(
      routes({ 'GET /dashboard/summary': () => (fail ? new ApiError(0, 'Sem conexão', 'Não foi possível conectar ao servidor.') : summary) }),
    );
    renderApp(<DashboardPage />, { api });
    expect(await screen.findByText('Não foi possível conectar ao servidor.')).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getAllByRole('button', { name: 'Tentar de novo' })[0]!);
    expect(await screen.findByLabelText('Saldo total')).toBeInTheDocument();
  });
});
