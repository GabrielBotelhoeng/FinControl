import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeApi } from '../../test/fakes';
import { renderApp } from '../../test/render';
import DebtDetailPage from './debt-detail-page';
import DebtsPage from './debts-page';

const accounts = [
  {
    id: 'a1', name: 'Conta corrente', type: 'checking', color: '#2563eb', initialBalance: 0, balance: 500000, archivedAt: null,
    createdAt: '2026-01-01T00:00:00Z', creditLimit: null, closingDay: null, dueDay: null, paymentAccountId: null, card: null,
  },
];

const debt = (over: Record<string, unknown> = {}) => ({
  id: 'd1', name: 'Crediário da loja de móveis', creditor: 'Loja de móveis', kind: 'store', since: '2026-05-15',
  original: 240000, interest: 0, discounts: 30000, paid: 60000, balance: 150000, fraction: 60000 / 210000,
  status: 'agreement', nextDue: { date: '2026-12-08', amount: 30000 }, ...over,
});

const detail = (over: Record<string, unknown> = {}) => ({
  ...debt(),
  lastAnchorDate: '2026-10-09',
  agreement: {
    date: '2026-10-09', total: 210000, downPayment: 30000, installments: 6, installmentAmount: 30000,
    schedule: [
      { transactionId: 't1', number: 1, dueDate: '2026-11-08', amount: 30000, paidDate: '2026-11-08', overdue: false },
      { transactionId: 't2', number: 2, dueDate: '2026-12-08', amount: 30000, paidDate: null, overdue: false },
    ],
  },
  timeline: [
    { kind: 'payment', id: 't1', date: '2026-11-08', amount: 30000, description: 'Acordo Crediário da loja de móveis (1/6)' },
    { kind: 'agreement', id: 'e3', date: '2026-10-09', amount: 210000, delta: -30000, installments: 6, installmentAmount: 30000, downPayment: 30000, cancelledAt: null },
    { kind: 'note', id: 'e2', date: '2026-10-07', text: 'Liguei e pedi desconto.', amount: 210000 },
    { kind: 'valuation', id: 'e1', date: '2026-05-15', amount: 240000, delta: null, note: null },
  ],
  ...over,
});

describe('DebtsPage', () => {
  it('lista com credor, situação, saldo, progresso e próxima parcela, e o resumo no topo', async () => {
    renderApp(<DebtsPage />, {
      api: fakeApi({ 'GET /debts': [debt(), debt({ id: 'd2', name: 'Conta de luz atrasada', kind: 'utility', status: 'open', interest: 2650, balance: 21390, paid: 0, discounts: 0, fraction: 0, nextDue: null })] }),
    });
    const item = await screen.findByRole('article', { name: 'Crediário da loja de móveis' });
    expect(item).toHaveTextContent('Loja de móveis');
    expect(item).toHaveTextContent('Em acordo');
    expect(item).toHaveTextContent(/Saldo\s*R\$\s*1\.500,00/);
    expect(item).toHaveTextContent('29% pago');
    expect(item).toHaveTextContent(/Próxima parcela\s*R\$\s*300,00 em 08\/12\/2026/);
    expect(within(item).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '29');
    expect(within(item).getByRole('link', { name: /Ver detalhes/ })).toHaveAttribute('href', '/dividas/d1');

    const luz = screen.getByRole('article', { name: 'Conta de luz atrasada' });
    expect(luz).toHaveTextContent('Em aberto');
    expect(luz).toHaveTextContent(/Juros e multas\s*R\$\s*26,50/);

    const totals = screen.getByRole('group', { name: 'Resumo das dívidas' });
    expect(totals).toHaveTextContent(/Você deve\s*R\$\s*1\.713,90/);
  });

  it('sem dívidas mostra o estado vazio com "Nova dívida"', async () => {
    renderApp(<DebtsPage />, { api: fakeApi({ 'GET /debts': [] }) });
    expect(await screen.findByRole('heading', { name: 'Nenhuma dívida cadastrada' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Nova dívida' }).length).toBeGreaterThan(0);
  });

  it('cadastro envia o valor original, a data e o valor de hoje, e mostra os juros antes de salvar', async () => {
    const client = fakeApi({ 'GET /debts': [], 'POST /debts': detail({ id: 'novo' }), 'GET /debts/novo': detail({ id: 'novo' }) });
    renderApp(<DebtsPage />, { api: client, extraRoutes: { '/dividas/:id': <p>Detalhe</p> } });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Nova dívida' }))[0]!);
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Luz');
    await userEvent.type(within(dialog).getByLabelText('Credor'), 'Energia');
    await userEvent.selectOptions(within(dialog).getByLabelText('Tipo'), 'utility');
    await userEvent.type(within(dialog).getByLabelText('Valor original'), '18740');
    await userEvent.type(within(dialog).getByLabelText('Valor hoje (opcional)'), '21390');
    expect(within(dialog).getByText(/R\$\s*26,50 de juros e multas desde o começo/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar dívida' }));
    expect(client.post).toHaveBeenCalledWith('/debts', expect.objectContaining({
      name: 'Luz', creditor: 'Energia', kind: 'utility', originalAmount: 18740, currentAmount: 21390,
    }));
    expect(await screen.findByText('Detalhe')).toBeInTheDocument();
  });
});

function renderDetail(client = fakeApi({ 'GET /debts/d1': detail(), 'GET /accounts': accounts })) {
  renderApp(<DebtDetailPage />, { route: '/dividas/d1', path: '/dividas/:id', api: client, extraRoutes: { '/dividas': <p>Lista</p> } });
  return client;
}

describe('DebtDetailPage', () => {
  it('mostra os números (V6), o acordo com as parcelas e o histórico', async () => {
    renderDetail();
    const numbers = await screen.findByRole('group', { name: 'Números da dívida' });
    expect(numbers).toHaveTextContent(/Valor original\s*R\$\s*2\.400,00/);
    expect(numbers).toHaveTextContent(/Descontos\s*R\$\s*300,00/);
    expect(numbers).toHaveTextContent(/Falta pagar\s*R\$\s*1\.500,00/);
    const agreement = screen.getByRole('region', { name: 'Acordo' });
    expect(agreement).toHaveTextContent('1ª parcela · 08/11/2026');
    expect(agreement).toHaveTextContent(/R\$\s*300,00 · paga/);
    expect(agreement).toHaveTextContent(/R\$\s*300,00 · a pagar/);
    const history = screen.getByRole('region', { name: 'Histórico' });
    expect(history).toHaveTextContent(/Acordo de R\$\s*2\.100,00/);
    expect(history).toHaveTextContent(/R\$\s*300,00 de desconto/);
    expect(history).toHaveTextContent('Liguei e pedi desconto.');
  });

  it('em acordo: sem "Registrar pagamento" nem "Atualizar valor", com "Cancelar acordo"', async () => {
    renderDetail();
    await screen.findByRole('group', { name: 'Números da dívida' });
    expect(screen.queryByRole('button', { name: 'Registrar pagamento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Atualizar valor' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar acordo' })).toBeInTheDocument();
  });

  it('em aberto: registrar pagamento envia valor, data e conta; maior que o saldo avisa sem chamar a API', async () => {
    const open = detail({ status: 'open', agreement: null, nextDue: null, lastAnchorDate: '2026-11-01' });
    const client = fakeApi({ 'GET /debts/d1': open, 'GET /accounts': accounts, 'POST /debts/d1/payments': open });
    renderDetail(client);
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar pagamento' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Valor pago'), '200000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar' }));
    expect(await within(dialog).findByText(/O saldo é R\$\s*1\.500,00/)).toBeInTheDocument();
    expect(client.post).not.toHaveBeenCalled();
    await userEvent.clear(within(dialog).getByLabelText('Valor pago'));
    await userEvent.type(within(dialog).getByLabelText('Valor pago'), '5000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar' }));
    expect(client.post).toHaveBeenCalledWith('/debts/d1/payments', expect.objectContaining({ amount: 5000, accountId: 'a1' }));
  });

  it('fechar acordo mostra o desconto e envia entrada, parcelas e conta', async () => {
    const open = detail({ status: 'open', agreement: null, nextDue: null });
    const client = fakeApi({ 'GET /debts/d1': open, 'GET /accounts': accounts, 'POST /debts/d1/agreement': detail() });
    renderDetail(client);
    await userEvent.click(await screen.findByRole('button', { name: 'Fechar acordo' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Entrada (opcional)'), '10000');
    await userEvent.type(within(dialog).getByLabelText('Número de parcelas'), '4');
    await userEvent.type(within(dialog).getByLabelText('Valor da parcela'), '20000');
    expect(within(dialog).getByText(/Total do acordo R\$\s*900,00: R\$\s*600,00 de desconto/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Fechar acordo' }));
    expect(client.post).toHaveBeenCalledWith('/debts/d1/agreement', expect.objectContaining({ downPayment: 10000, installments: 4, installmentAmount: 20000, accountId: 'a1' }));
  });

  it('registrar negociação exige o texto', async () => {
    const client = fakeApi({ 'GET /debts/d1': detail(), 'GET /accounts': accounts, 'POST /debts/d1/notes': detail() });
    renderDetail(client);
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar negociação' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar' }));
    expect(await within(dialog).findByText('Conte o que aconteceu na negociação.')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('O que aconteceu'), 'Ofereceram 40% à vista');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar' }));
    expect(client.post).toHaveBeenCalledWith('/debts/d1/notes', { text: 'Ofereceram 40% à vista' });
  });

  it('excluir volta para a lista', async () => {
    const client = fakeApi({ 'GET /debts/d1': detail(), 'GET /accounts': accounts, 'DELETE /debts/d1': undefined, 'GET /debts': [] });
    renderDetail(client);
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir dívida' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Excluir' }));
    expect(await screen.findByText('Lista')).toBeInTheDocument();
    expect(client.del).toHaveBeenCalledWith('/debts/d1');
  });
});
