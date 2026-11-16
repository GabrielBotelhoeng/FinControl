import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeApi } from '../../test/fakes';
import { renderApp } from '../../test/render';
import PlanningPage from './planning-page';

export const budgetMonth = (over: Record<string, unknown> = {}) => ({
  month: '2026-11',
  items: [
    { categoryId: 'food', name: 'Alimentação', icon: 'utensils', color: '#f97316', limit: 50000, paid: 30000, pending: 15000, committed: 45000, percent: 90, status: 'near', suggested: 49000 },
    { categoryId: 'fun', name: 'Lazer', icon: 'party-popper', color: '#ec4899', limit: 30000, paid: 33000, pending: 0, committed: 33000, percent: 110, status: 'over', suggested: null },
  ],
  categoriesWithoutBudget: [{ categoryId: 'shop', name: 'Compras', icon: 'shopping-bag', color: '#eab308', suggested: 49000 }],
  totals: { limit: 80000, committed: 78000 },
  income: { paid: 500000, pending: 100000 },
  plannedLeftover: 520000,
  ...over,
});

const forecast = [
  { month: '2026-11', income: 600000, expense: 450000 },
  { month: '2026-12', income: 650000, expense: 400000 },
  { month: '2027-01', income: 650000, expense: 700000 },
];

function api(over: Record<string, unknown> = {}) {
  return fakeApi({
    'GET /budgets': budgetMonth(),
    'GET /planning/forecast': forecast,
    'GET /goals': [],
    'GET /dashboard/summary': { health: { averageMonthlyExpense: 400000 } },
    'PUT /budgets': (path: string, body: unknown) => ({ categoryId: path.split('/').pop(), ...(body as object) }),
    ...over,
  });
}

const renderPage = (client = api(), route = '/planejamento') => {
  renderApp(<PlanningPage />, { route, path: '/planejamento', api: client });
  return client;
};

describe('PlanningPage — aba Orçamento', () => {
  it('mostra cada categoria com barra, "R$ X de R$ Y" e a situação escrita', async () => {
    renderPage();
    const food = await screen.findByRole('article', { name: 'Alimentação' });
    expect(food).toHaveTextContent(/R\$\s*450,00 de R\$\s*500,00/);
    expect(within(food).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '90');
    expect(food).toHaveTextContent('Perto do limite');
    expect(screen.getByRole('article', { name: 'Lazer' })).toHaveTextContent('Estourou');
  });

  it('resumo do mês: receitas, orçamento total, comprometido e sobra planejada', async () => {
    renderPage();
    const summary = await screen.findByRole('group', { name: 'Resumo do mês' });
    expect(summary).toHaveTextContent(/Receitas do mês\s*R\$\s*6\.000,00/);
    expect(summary).toHaveTextContent(/Orçamento total\s*R\$\s*800,00/);
    expect(summary).toHaveTextContent(/Comprometido\s*R\$\s*780,00/);
    expect(summary).toHaveTextContent(/Sobra planejada\s*R\$\s*5\.200,00/);
  });

  it('categoria sem limite: "Definir limite" abre o formulário com a sugestão e envia o PUT', async () => {
    const client = renderPage();
    const shop = await screen.findByRole('article', { name: 'Compras' });
    await userEvent.click(within(shop).getByRole('button', { name: 'Definir limite' }));
    const dialog = await screen.findByRole('dialog', { name: 'Limite de Compras' });
    expect(dialog).toHaveTextContent(/Sugestão: R\$\s*490,00, a média dos últimos 3 meses/);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Usar sugestão' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar limite' }));
    expect(client.patch).not.toHaveBeenCalled();
    expect(client.put).toHaveBeenCalledWith('/budgets/shop', { limit: 49000 });
  });

  it('próximos 3 meses: receitas, despesas e saldo previsto de cada mês', async () => {
    renderPage();
    const box = await screen.findByRole('region', { name: 'Próximos 3 meses' });
    expect(await within(box).findAllByRole('listitem')).toHaveLength(3);
    expect(box).toHaveTextContent(/jan\/2027/);
    expect(box).toHaveTextContent(/−R\$\s*500,00/);
  });

  it('as abas Orçamento e Metas', async () => {
    renderPage();
    expect(await screen.findByRole('tab', { name: 'Orçamento', selected: true })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Metas' }));
    expect(await screen.findByRole('tab', { name: 'Metas', selected: true })).toBeInTheDocument();
  });
});
