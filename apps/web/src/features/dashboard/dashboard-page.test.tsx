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
  upcoming: [
    { id: 't1', type: 'expense', amount: 11990, description: 'Internet', accountId: 'a1', destinationAccountId: null, categoryId: 'c1', nature: 'fixed', status: 'pending', dueDate: '2026-10-15', paidDate: null, recurrenceId: 'r1', occurrenceDate: '2026-10-15', overdue: true, createdAt: '' },
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
