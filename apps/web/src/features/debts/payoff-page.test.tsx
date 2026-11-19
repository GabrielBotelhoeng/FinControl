import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeApi } from '../../test/fakes';
import { renderApp } from '../../test/render';
import PayoffPage from './payoff-page';

const loan = {
  id: 'l1', name: 'Empréstimo pessoal', kind: 'personal', bankName: 'Banco', bankCnpj8: null, principal: 300000, installmentAmount: 20000,
  installmentsTotal: 18, installmentsPaid: 6, monthlyRate: 0.02, annualRate: 0.27, outstanding: 211000, nextDue: { date: '2026-12-01', amount: 20000 },
};
const debt = (over: Record<string, unknown>) => ({
  id: 'd1', name: 'Cheque especial', creditor: 'Banco', kind: 'bank', since: '2026-01-01', original: 100000, interest: 0, discounts: 0,
  paid: 0, balance: 100000, fraction: 0, status: 'open', nextDue: null, ...over,
});

function renderPage(debts = [debt({}), debt({ id: 'd2', name: 'Loja', balance: 30000, status: 'agreement', nextDue: { date: '2026-12-05', amount: 10000 } })]) {
  renderApp(<PayoffPage />, { api: fakeApi({ 'GET /loans': [loan], 'GET /debts': debts }) });
}

describe('PayoffPage', () => {
  beforeEach(() => localStorage.clear());

  it('começa pelo mínimo (soma das parcelas) e mostra as três estratégias', async () => {
    renderPage();
    const budget = await screen.findByLabelText('Quanto você pode pagar por mês para dívidas');
    expect(budget).toHaveValue('300,00');
    expect(screen.getByRole('button', { name: /^Avalanche:/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Bola de neve:/ })).toBeInTheDocument();
    // Sem juros informados no cheque especial e sem parcela, só o mínimo não quita.
    expect(screen.getByRole('button', { name: /^Só o mínimo: não quita/ })).toBeInTheDocument();
  });

  it('com juros no cheque especial e valor maior, a avalanche ataca o cheque especial primeiro', async () => {
    renderPage();
    await userEvent.type(await screen.findByLabelText('Juros ao mês (%) de Cheque especial'), '8');
    const budget = screen.getByLabelText('Quanto você pode pagar por mês para dívidas');
    await userEvent.clear(budget);
    await userEvent.type(budget, '80000');
    expect(screen.getByRole('button', { name: /^Avalanche:/ })).toHaveTextContent('Menos juros');
    const order = screen.getByRole('region', { name: 'Ordem de quitação' });
    const items = within(order).getAllByRole('listitem').map((li) => li.textContent);
    expect(items.findIndex((t) => t?.includes('Cheque especial'))).toBeLessThan(items.findIndex((t) => t?.includes('Empréstimo pessoal')));
    expect(screen.getByRole('status')).toHaveTextContent('Pagando só as parcelas, alguma dívida nunca acaba.');
  });

  it('valor abaixo das parcelas avisa e não simula', async () => {
    renderPage();
    const budget = await screen.findByLabelText('Quanto você pode pagar por mês para dívidas');
    await userEvent.clear(budget);
    await userEvent.type(budget, '10000');
    expect(screen.getByText(/Precisa ser pelo menos R\$\s*300,00/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Avalanche:/ })).not.toBeInTheDocument();
  });

  it('guarda os dados no navegador', async () => {
    renderPage();
    await userEvent.type(await screen.findByLabelText('Juros ao mês (%) de Cheque especial'), '5');
    expect(JSON.parse(localStorage.getItem('fincontrol-plano-quitacao')!).overrides.d1.rate).toBe('5');
  });

  it('sem dívidas, explica o que entra no plano', async () => {
    renderApp(<PayoffPage />, { api: fakeApi({ 'GET /loans': [], 'GET /debts': [] }) });
    expect(await screen.findByRole('heading', { name: 'Nenhuma dívida para quitar' })).toBeInTheDocument();
  });
});
