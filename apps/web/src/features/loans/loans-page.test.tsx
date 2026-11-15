import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fakeApi } from '../../test/fakes';
import { renderApp } from '../../test/render';
import LoansPage from './loans-page';

export const loan = (over: Record<string, unknown> = {}) => ({
  id: 'l1', name: 'Financiamento do carro', kind: 'vehicle', bankName: 'BCO DO BRASIL S.A.', bankCnpj8: '00000000',
  principal: 3000000, installmentAmount: 95000, installmentsTotal: 48, installmentsPaid: 12,
  monthlyRate: 0.0185795, annualRate: 0.247209, outstanding: 2477608, nextDue: { date: '2026-12-01', amount: 95000 },
  ...over,
});

const accounts = [
  {
    id: 'a1', name: 'Conta corrente', type: 'checking', color: '#2563eb', initialBalance: 0, balance: 500000, archivedAt: null,
    createdAt: '2026-01-01T00:00:00Z', creditLimit: null, closingDay: null, dueDay: null, paymentAccountId: null, card: null,
  },
];

describe('LoansPage', () => {
  it('lista o empréstimo com banco, progresso, taxa real e saldo devedor', async () => {
    renderApp(<LoansPage />, { api: fakeApi({ 'GET /loans': [loan()], 'GET /accounts': accounts }) });
    const item = await screen.findByRole('article', { name: 'Financiamento do carro' });
    expect(item).toHaveTextContent('BCO DO BRASIL S.A.');
    expect(item).toHaveTextContent('12 de 48 pagas');
    const bar = within(item).getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '12');
    expect(bar).toHaveAttribute('aria-valuemax', '48');
    expect(item).toHaveTextContent('1,86% ao mês');
    expect(item).toHaveTextContent(/Saldo devedor\s*R\$\s*24\.776,08/);
    expect(within(item).getByRole('link', { name: /Ver detalhes/ })).toHaveAttribute('href', '/emprestimos/l1');
  });

  it('sem empréstimos mostra o estado vazio com "Cadastrar empréstimo"', async () => {
    renderApp(<LoansPage />, { api: fakeApi({ 'GET /loans': [], 'GET /accounts': accounts }) });
    expect(await screen.findByRole('heading', { name: 'Nenhum empréstimo ainda' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Cadastrar empréstimo' }).length).toBeGreaterThan(0);
  });
});
