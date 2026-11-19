import { addMonthsToYm, monthOf, todayInSaoPaulo } from '@fincontrol/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fakeApi } from '../../test/fakes';
import { renderApp } from '../../test/render';
import SummaryPage from './summary-page';

const totals = { income: 500000, expense: 300000, net: 200000, savingsRate: 0.4, previousIncome: 0, previousExpense: 0, incomeChange: null, expenseChange: null };

describe('SummaryPage', () => {
  it('abre no mês passado e mostra as frases do mês', async () => {
    const previous = addMonthsToYm(monthOf(todayInSaoPaulo()), -1);
    const client = fakeApi({
      'GET /reports': { totals, expenseByCategory: [], incomeByCategory: [], monthly: [], debts: [], topExpenses: [], balances: { date: '', items: [], total: 0 }, period: {} },
      'GET /budgets': { items: [] },
      'GET /repeated': [{ description: 'Netflix', monthly: 3990, yearly: 47880, months: 3, lastDate: '2026-10-05', nextDate: '2026-11-04', recurring: false }],
    });
    renderApp(<SummaryPage />, { api: client });
    expect(await screen.findByText(/^Sobrou R\$\s*2\.000,00$/)).toBeInTheDocument();
    expect(client.get).toHaveBeenCalledWith('/reports', { from: previous, to: previous });
    expect(await screen.findByRole('region', { name: 'Gastos que se repetem todo mês' })).toHaveTextContent(/Netflix.*39,90 por mês.*478,80 por ano/);
  });
});
