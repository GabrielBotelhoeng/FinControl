import { addMonthsToYm, endOfMonth } from '@fincontrol/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api-client';
import { fakeApi } from '../../test/fakes';
import { renderApp } from '../../test/render';
import NetWorthPage from './net-worth-page';

const asset = (over: Record<string, unknown> = {}) => ({
  id: 'a1', name: 'Carro', kind: 'vehicle', value: 4000000, since: '2025-11-20', firstValue: 4500000, updatedOn: '2026-11-11', ...over,
});

const netWorth = (over: Record<string, unknown> = {}) => ({
  date: '2026-11-19',
  accounts: {
    items: [
      { accountId: 'c1', name: 'Corrente', type: 'checking', balance: 740000 },
      { accountId: 'c2', name: 'Poupança', type: 'savings', balance: 100000 },
    ],
    cardCredit: 0,
    total: 840000,
  },
  assets: { items: [asset(), asset({ id: 'a2', name: 'Moto', value: 0, firstValue: 900000, since: '2024-01-10', updatedOn: '2026-10-01' })], total: 4000000 },
  debts: { cards: 110000, loans: 0, others: 130000, total: 240000 },
  total: 4600000,
  series: Array.from({ length: 12 }, (_, i) => {
    const month = addMonthsToYm('2025-12', i);
    return { month, date: i === 11 ? '2026-11-19' : endOfMonth(month), accounts: 600000, assets: 4500000, debts: 0, total: i === 11 ? 4600000 : 5100000 };
  }),
  ...over,
});

const detail = (valuations: { id: string; date: string; amount: number }[]) => ({ ...asset(), valuations });

function api(over: Record<string, unknown> = {}) {
  return fakeApi({
    'GET /net-worth': netWorth(),
    'GET /assets/a1': detail([{ id: 'v2', date: '2026-11-11', amount: 4000000 }, { id: 'v1', date: '2025-11-20', amount: 4500000 }]),
    'POST /assets': (_p: string, body: unknown) => ({ ...asset({ id: 'a9' }), ...(body as object), valuations: [] }),
    'POST /assets/a1/valuations': () => detail([]),
    'PATCH /assets/a1': (_p: string, body: unknown) => ({ ...detail([]), ...(body as object) }),
    'DELETE /assets/a1': undefined,
    ...over,
  });
}

async function openCar() {
  await userEvent.click(within(await screen.findByRole('article', { name: 'Carro' })).getByRole('button', { name: 'Ver histórico e atualizar' }));
  return screen.findByRole('dialog', { name: 'Carro' });
}

describe('NetWorthPage (sub-projeto 11)', () => {
  it('mostra o patrimônio de hoje, a variação desde o 1º mês do gráfico, o que tem e o que deve (B11)', async () => {
    renderApp(<NetWorthPage />, { api: api() });
    expect(await screen.findByLabelText('Patrimônio líquido hoje')).toHaveTextContent(/R\$\s*46\.000,00/);
    expect(screen.getByText(/desde o fim de dez\/2025/)).toHaveTextContent(/−R\$\s*5\.000,00 desde o fim de dez\/2025/);
    const have = screen.getByRole('region', { name: 'O que você tem' });
    expect(have).toHaveTextContent(/R\$\s*48\.400,00/);
    expect(have).toHaveTextContent(/Corrente\s*R\$\s*7\.400,00/);
    expect(have).toHaveTextContent(/Bens\s*R\$\s*40\.000,00/);
    expect(have).not.toHaveTextContent('Crédito nos cartões');
    const owe = screen.getByRole('region', { name: 'O que você deve' });
    expect(owe).toHaveTextContent(/R\$\s*2\.400,00/);
    expect(owe).toHaveTextContent(/Cartões\s*R\$\s*1\.100,00/);
    expect(owe).toHaveTextContent(/Credores\s*R\$\s*1\.300,00/);
    expect(within(owe).getByRole('link', { name: 'Ver dívidas' })).toHaveAttribute('href', '/dividas');
    expect(screen.getByText(/nov\/2026: o que você tem/)).toBeInTheDocument();
  });

  it('revisão: o crédito dos cartões pagos a mais aparece em "O que você tem"', async () => {
    const items = netWorth().accounts.items;
    renderApp(<NetWorthPage />, { api: api({ 'GET /net-worth': netWorth({ accounts: { items, cardCredit: 50000, total: 890000 } }) }) });
    const have = await screen.findByRole('region', { name: 'O que você tem' });
    expect(have).toHaveTextContent(/R\$\s*48\.900,00/);
    expect(have).toHaveTextContent(/Crédito nos cartões\s*R\$\s*500,00/);
  });

  it('erro ao carregar mostra a mensagem e "Tentar de novo"', async () => {
    renderApp(<NetWorthPage />, { api: api({ 'GET /net-worth': () => new ApiError(500, 'Erro', 'Não foi possível carregar o patrimônio.') }) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o patrimônio.');
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('lista os bens com tipo, valor, atualização e variação; o vendido diz que está sem valor', async () => {
    renderApp(<NetWorthPage />, { api: api() });
    const car = await screen.findByRole('article', { name: 'Carro' });
    expect(car).toHaveTextContent('Veículo');
    expect(car).toHaveTextContent(/R\$\s*40\.000,00/);
    expect(car).toHaveTextContent('Atualizado em 11/11/2026');
    expect(car).toHaveTextContent(/−R\$\s*5\.000,00 desde 20\/11\/2025/);
    expect(screen.getByRole('article', { name: 'Moto' })).toHaveTextContent('Vendido ou sem valor hoje');
  });

  it('sem bens e sem dívidas: estado vazio e o aviso de nenhuma dívida', async () => {
    renderApp(<NetWorthPage />, {
      api: api({ 'GET /net-worth': netWorth({ assets: { items: [], total: 0 }, debts: { cards: 0, loans: 0, others: 0, total: 0 } }) }),
    });
    expect(await screen.findByText('Nenhum bem cadastrado')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'O que você deve' })).toHaveTextContent('Nenhuma dívida em cartões, empréstimos ou com credores');
  });

  it('"Novo bem" com data no passado pede o valor na compra e envia centavos (B5)', async () => {
    const client = api();
    renderApp(<NetWorthPage />, { api: client });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Novo bem' }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Novo bem' });
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Apartamento');
    await userEvent.selectOptions(within(dialog).getByLabelText('Tipo'), 'property');
    await userEvent.type(within(dialog).getByLabelText('Valor hoje'), '35000000');
    expect(within(dialog).queryByLabelText('Valor na compra (opcional)')).not.toBeInTheDocument();
    await userEvent.clear(within(dialog).getByLabelText('Desde quando você tem'));
    await userEvent.type(within(dialog).getByLabelText('Desde quando você tem'), '2020-03-01');
    await userEvent.type(within(dialog).getByLabelText('Valor na compra (opcional)'), '28000000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar bem' }));
    expect(client.post).toHaveBeenCalledWith('/assets', { name: 'Apartamento', kind: 'property', value: 35000000, since: '2020-03-01', purchaseValue: 28000000 });
  });

  it('o investimento avisa que conta do tipo Investimento já entra pelo saldo (B4)', async () => {
    renderApp(<NetWorthPage />, { api: api() });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Novo bem' }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Novo bem' });
    await userEvent.selectOptions(within(dialog).getByLabelText('Tipo'), 'investment');
    expect(dialog).toHaveTextContent('já entra pelo saldo da conta');
  });

  it('histórico: atualizar valor, "vendi ou perdi" manda zero e excluir um registro (B6)', async () => {
    const client = api();
    renderApp(<NetWorthPage />, { api: client });
    const dialog = await openCar();
    expect(await within(dialog).findByRole('listitem', { name: /20\/11\/2025/ })).toHaveTextContent(/R\$\s*45\.000,00/);
    // Revisão: o nome do botão leva o valor, para dois registros no mesmo dia não terem o mesmo nome.
    expect(within(dialog).getByRole('button', { name: /Excluir o valor de R\$\s*40\.000,00 de 11\/11\/2026/ })).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('Novo valor'), '3900000');
    await userEvent.clear(within(dialog).getByLabelText('Data do valor'));
    await userEvent.type(within(dialog).getByLabelText('Data do valor'), '2026-11-15');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar valor' }));
    expect(client.post).toHaveBeenCalledWith('/assets/a1/valuations', { amount: 3900000, date: '2026-11-15' });

    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Vendi ou perdi este bem' }));
    expect(within(dialog).getByLabelText('Novo valor')).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar valor' }));
    expect(client.post).toHaveBeenLastCalledWith('/assets/a1/valuations', { amount: 0, date: '2026-11-15' });

    await userEvent.click(within(dialog).getByRole('button', { name: /Excluir o valor de R\$\s*45\.000,00 de 20\/11\/2025/ }));
    expect(client.del).toHaveBeenCalledWith('/assets/a1/valuations/v1');
  });

  it('a recusa da API aparece no diálogo (venda antes de um valor posterior, B6)', async () => {
    const message = 'Há um valor registrado depois desta data. Para registrar a venda nela, exclua antes os valores posteriores.';
    renderApp(<NetWorthPage />, { api: api({ 'POST /assets/a1/valuations': () => new ApiError(422, 'Regra', message) }) });
    const dialog = await openCar();
    await userEvent.click(await within(dialog).findByRole('checkbox', { name: 'Vendi ou perdi este bem' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar valor' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message);
  });

  it('o único registro não pode ser excluído; excluir o bem pede confirmação (B7)', async () => {
    const client = api({ 'GET /assets/a1': detail([{ id: 'v1', date: '2025-11-20', amount: 4500000 }]) });
    renderApp(<NetWorthPage />, { api: client });
    const dialog = await openCar();
    expect(await within(dialog).findByRole('button', { name: /Excluir o valor de R\$\s*45\.000,00 de 20\/11\/2025/ })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir bem' }));
    expect(dialog).toHaveTextContent('Ele sai também dos meses passados do gráfico.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar exclusão' }));
    expect(client.del).toHaveBeenCalledWith('/assets/a1');
  });

  it('editar o bem muda o nome e o tipo, e o título do diálogo acompanha (revisão)', async () => {
    let assetName = 'Carro';
    const client = api({
      'GET /assets/a1': () => ({ ...detail([{ id: 'v1', date: '2025-11-20', amount: 4500000 }]), name: assetName }),
      'PATCH /assets/a1': (_p: string, body: unknown) => {
        assetName = (body as { name: string }).name;
        return { ...detail([]), name: assetName };
      },
    });
    renderApp(<NetWorthPage />, { api: client });
    const dialog = await openCar();
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Editar bem' }));
    const form = await screen.findByRole('dialog', { name: 'Editar bem' });
    const name = within(form).getByLabelText('Nome');
    expect(name).toHaveValue('Carro');
    await userEvent.clear(name);
    await userEvent.type(name, 'Carro da família');
    await userEvent.click(within(form).getByRole('button', { name: 'Salvar bem' }));
    expect(client.patch).toHaveBeenCalledWith('/assets/a1', { name: 'Carro da família', kind: 'vehicle' });
    expect(await screen.findByRole('dialog', { name: 'Carro da família' })).toBeInTheDocument();
  });
});
