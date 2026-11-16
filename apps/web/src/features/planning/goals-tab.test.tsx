import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api-client';
import { fakeApi } from '../../test/fakes';
import { renderApp } from '../../test/render';
import { GoalsTab } from './goals-tab';

const goal = (over: Record<string, unknown> = {}) => ({
  id: 'g1', name: 'Viagem', targetAmount: 600000, targetDate: '2027-05-16', saved: 150000, createdAt: '2026-05-16',
  fraction: 0.25, status: 'late', monthlyNeeded: 64286, monthsLeft: 7, ...over,
});

function api(over: Record<string, unknown> = {}) {
  return fakeApi({
    'GET /goals/g1': { ...goal(), contributions: [{ id: 'c1', amount: 150000, date: '2026-11-10', note: null }] },
    'GET /goals': [goal(), goal({ id: 'g2', name: 'Notebook', saved: 400000, targetAmount: 400000, fraction: 1, status: 'reached', monthlyNeeded: 0 })],
    'GET /dashboard/summary': { health: { averageMonthlyExpense: 450000 } },
    'POST /goals': (_p: string, body: unknown) => ({ ...goal(), id: 'g9', ...(body as object), contributions: [] }),
    'POST /goals/g1/contributions': (_p: string, body: unknown) => ({ id: 'c2', note: null, ...(body as object) }),
    'DELETE /goals/g1': undefined,
    ...over,
  });
}

describe('GoalsTab', () => {
  it('cartão: "R$ X de R$ Y", barra, situação escrita e o aporte mensal até o prazo', async () => {
    renderApp(<GoalsTab />, { api: api() });
    const card = await screen.findByRole('article', { name: 'Viagem' });
    expect(card).toHaveTextContent(/R\$\s*1\.500,00 de R\$\s*6\.000,00/);
    expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
    expect(card).toHaveTextContent('Atrasada');
    expect(card).toHaveTextContent(/Guarde R\$\s*642,86 por mês até mai\/2027/);
    const done = screen.getByRole('article', { name: 'Notebook' });
    expect(done).toHaveTextContent('Concluída');
    expect(done).not.toHaveTextContent('Guarde');
    expect(screen.getByText('Sem rendimento: o cálculo considera só o que você guardar.')).toBeInTheDocument();
  });

  it('"Nova meta" envia centavos e a data', async () => {
    const client = api();
    renderApp(<GoalsTab />, { api: client });
    await userEvent.click(await screen.findByRole('button', { name: 'Nova meta' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nova meta' });
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Carro');
    await userEvent.type(within(dialog).getByLabelText('Valor da meta'), '2000000');
    await userEvent.clear(within(dialog).getByLabelText('Prazo'));
    await userEvent.type(within(dialog).getByLabelText('Prazo'), '2028-01-31');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar meta' }));
    expect(client.post).toHaveBeenCalledWith('/goals', { name: 'Carro', targetAmount: 2000000, targetDate: '2028-01-31' });
  });

  it('atalho da reserva: nome, alvo de 6× o gasto médio e prazo em 12 meses (P8)', async () => {
    renderApp(<GoalsTab />, { api: api() });
    await userEvent.click(await screen.findByRole('button', { name: 'Meta de reserva de emergência' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nova meta' });
    expect(within(dialog).getByLabelText('Nome')).toHaveValue('Reserva de emergência');
    expect(within(dialog).getByLabelText('Valor da meta')).toHaveValue('27.000,00');
    expect((within(dialog).getByLabelText('Prazo') as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('detalhe: lista os depósitos, registra depósito e retirada, e mostra o erro da retirada', async () => {
    const client = api({
      'POST /goals/g1/contributions': (_p: string, body: unknown) => {
        if ((body as { amount: number }).amount < 0) throw new ApiError(422, 'Regra de negócio', 'Não dá para retirar mais do que está guardado.');
        return { id: 'c2', note: null, ...(body as object) };
      },
    });
    renderApp(<GoalsTab />, { api: client });
    await userEvent.click(within(await screen.findByRole('article', { name: 'Viagem' })).getByRole('button', { name: 'Ver detalhes' }));
    const dialog = await screen.findByRole('dialog', { name: 'Viagem' });
    expect(await within(dialog).findByText(/10\/11\/2026/)).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('Valor'), '50000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar depósito' }));
    expect(client.post).toHaveBeenCalledWith('/goals/g1/contributions', expect.objectContaining({ amount: 50000 }));
    await userEvent.type(within(dialog).getByLabelText('Valor'), '900000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar retirada' }));
    expect(client.post).toHaveBeenCalledWith('/goals/g1/contributions', expect.objectContaining({ amount: -900000 }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Não dá para retirar mais do que está guardado.');
  });

  it('"Excluir meta" pede confirmação e envia o DELETE', async () => {
    const client = api();
    renderApp(<GoalsTab />, { api: client });
    await userEvent.click(within(await screen.findByRole('article', { name: 'Viagem' })).getByRole('button', { name: 'Ver detalhes' }));
    const dialog = await screen.findByRole('dialog', { name: 'Viagem' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir meta' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar exclusão' }));
    expect(client.del).toHaveBeenCalledWith('/goals/g1');
  });

  it('sem metas, mostra o estado vazio com as duas ações', async () => {
    renderApp(<GoalsTab />, { api: api({ 'GET /goals': [] }) });
    expect(await screen.findByRole('heading', { name: 'Nenhuma meta ainda' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Nova meta' }).length).toBeGreaterThan(0);
  });

  it('revisão: o erro ao apagar um depósito aparece no diálogo', async () => {
    const client = api({
      'DELETE /goals/g1/contributions': () => {
        throw new ApiError(422, 'Regra de negócio', 'Apagar este depósito deixaria a meta com saldo negativo. Apague antes a retirada.');
      },
    });
    renderApp(<GoalsTab />, { api: client });
    await userEvent.click(within(await screen.findByRole('article', { name: 'Viagem' })).getByRole('button', { name: 'Ver detalhes' }));
    const dialog = await screen.findByRole('dialog', { name: 'Viagem' });
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Apagar lançamento de 10/11/2026' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('saldo negativo');
  });

  it('revisão: excluir a meta fecha o diálogo sem pedir de novo a meta apagada', async () => {
    const client = api();
    renderApp(<GoalsTab />, { api: client });
    await userEvent.click(within(await screen.findByRole('article', { name: 'Viagem' })).getByRole('button', { name: 'Ver detalhes' }));
    const dialog = await screen.findByRole('dialog', { name: 'Viagem' });
    await within(dialog).findByText(/10\/11\/2026/);
    const before = client.get.mock.calls.filter(([p]) => p === '/goals/g1').length;
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir meta' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar exclusão' }));
    expect(client.del).toHaveBeenCalledWith('/goals/g1');
    expect(screen.queryByRole('dialog', { name: 'Viagem' })).not.toBeInTheDocument();
    expect(client.get.mock.calls.filter(([p]) => p === '/goals/g1').length).toBe(before);
  });
});
