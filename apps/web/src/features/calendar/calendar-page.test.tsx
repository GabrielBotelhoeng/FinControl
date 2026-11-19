import { todayInSaoPaulo } from '@fincontrol/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeApi } from '../../test/fakes';
import { renderApp } from '../../test/render';
import CalendarPage from './calendar-page';

const today = todayInSaoPaulo();
const month = today.slice(0, 7);
const day = (d: number) => `${month}-${String(d).padStart(2, '0')}`;

const calendar = {
  month,
  days: [
    {
      date: day(3),
      items: [{ kind: 'transaction', id: 't1', description: 'Água', type: 'expense', amount: 5000, status: 'pending', overdue: true, category: 'Contas' }],
    },
    {
      date: day(5),
      items: [
        { kind: 'transaction', id: 't2', description: 'Salário', type: 'income', amount: 300000, status: 'paid', overdue: false, category: 'Salário' },
        { kind: 'invoice', cardId: 'c1', cardName: 'Cartão principal', month, remaining: 40000, amount: 40000, status: 'closed' },
      ],
    },
  ],
  totals: { toPay: 45000, paid: 0, toReceive: 0, received: 300000 },
};

describe('CalendarPage', () => {
  it('mostra os totais e marca os dias com contas, com a situação no nome do dia', async () => {
    renderApp(<CalendarPage />, { api: fakeApi({ 'GET /calendar': calendar }) });
    const totals = await screen.findByRole('group', { name: 'Totais do mês' });
    expect(totals).toHaveTextContent(/A pagar\s*R\$\s*450,00/);
    expect(totals).toHaveTextContent(/Recebido\s*R\$\s*3\.000,00/);
    const grid = screen.getByRole('grid', { name: 'Dias do mês' });
    expect(within(grid).getByRole('button', { name: new RegExp(`^03/.*1 item, conta vencida`) })).toBeInTheDocument();
    expect(within(grid).getByRole('button', { name: new RegExp(`^05/.*2 itens, contas a pagar`) })).toBeInTheDocument();
    expect(screen.getByText('Há contas vencidas neste mês.')).toBeInTheDocument();
  });

  it('tocar num dia lista o que vence, com "Pagar" e o link da fatura', async () => {
    const client = fakeApi({ 'GET /calendar': calendar, 'POST /transactions/t1/pay': {} });
    renderApp(<CalendarPage />, { api: client });
    const grid = await screen.findByRole('grid', { name: 'Dias do mês' });
    await userEvent.click(within(grid).getByRole('button', { name: /^05\// }));
    const list = screen.getByRole('region', { name: /^Contas de 05\// });
    expect(list).toHaveTextContent('Salário');
    expect(within(list).getByRole('link', { name: 'Ver fatura' })).toHaveAttribute('href', '/cartoes/c1');
    await userEvent.click(within(grid).getByRole('button', { name: /^03\// }));
    await userEvent.click(within(screen.getByRole('region', { name: /^Contas de 03\// })).getByRole('button', { name: 'Pagar' }));
    expect(client.post).toHaveBeenCalledWith('/transactions/t1/pay', {});
  });
});
