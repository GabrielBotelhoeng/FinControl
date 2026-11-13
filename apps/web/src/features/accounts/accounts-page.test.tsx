import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeApi } from '../../test/fakes';
import { renderApp } from '../../test/render';
import AccountsPage from './accounts-page';

const account = (over: Record<string, unknown> = {}) => ({
  id: 'a1', name: 'Nubank', type: 'checking', color: '#6366F1', initialBalance: 0, balance: 1248050, archivedAt: null, createdAt: '2026-11-01T00:00:00Z',
  creditLimit: null, closingDay: null, dueDay: null, paymentAccountId: null, card: null, ...over,
});

/** Cartão "Cartão principal": limite 8.000, fechamento 26, vencimento 5, pagadora = a1; 300 usados e em fatura aberta. */
const cardAccount = (over: Record<string, unknown> = {}) => account({
  id: 'c1', name: 'Cartão principal', type: 'credit_card', color: '#7c3aed', balance: -30000,
  creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountId: 'a1',
  card: { limitAvailable: 770000, openInvoice: { month: '2026-12', amount: 30000 }, nextDue: { date: '2026-12-05', amount: 30000 } },
  ...over,
});

describe('AccountsPage', () => {
  it('lista as contas com o saldo formatado', async () => {
    renderApp(<AccountsPage />, { api: fakeApi({ 'GET /accounts': [account(), account({ id: 'a2', name: 'Carteira', type: 'wallet', balance: -500 })] }) });
    const item = await screen.findByRole('article', { name: 'Nubank' });
    expect(item).toHaveTextContent(/R\$\s*12\.480,50/);
    expect(screen.getByRole('article', { name: 'Carteira' })).toHaveTextContent('Carteira');
  });

  it('sem contas mostra o estado vazio com a ação de criar', async () => {
    renderApp(<AccountsPage />, { api: fakeApi({ 'GET /accounts': [] }) });
    expect(await screen.findByRole('heading', { name: 'Nenhuma conta ainda' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Nova conta' }).length).toBeGreaterThan(0);
  });

  it('cria conta pelo formulário enviando centavos', async () => {
    const api = fakeApi({ 'GET /accounts': [], 'POST /accounts': account() });
    renderApp(<AccountsPage />, { api });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Nova conta' }))[0]!);
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Nubank');
    await userEvent.type(within(dialog).getByLabelText('Saldo inicial'), '150000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar conta' }));
    expect(api.post).toHaveBeenCalledWith('/accounts', expect.objectContaining({ name: 'Nubank', type: 'checking', initialBalance: 150000 }));
  });

  it('ao escolher "Cartão de crédito" mostra os campos do cartão e esconde o saldo inicial', async () => {
    const api = fakeApi({ 'GET /accounts': [account()] });
    renderApp(<AccountsPage />, { api });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Nova conta' }))[0]!);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Saldo inicial')).toBeInTheDocument();

    await userEvent.selectOptions(within(dialog).getByLabelText('Tipo'), 'credit_card');

    expect(within(dialog).getByLabelText('Limite')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Dia de fechamento')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Dia de vencimento')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Conta para pagar a fatura')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Saldo inicial')).not.toBeInTheDocument();
  });

  it('cria cartão enviando limite, fechamento, vencimento e conta pagadora', async () => {
    const checking = account();
    const api = fakeApi({ 'GET /accounts': [checking], 'POST /accounts': cardAccount() });
    renderApp(<AccountsPage />, { api });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Nova conta' }))[0]!);
    const dialog = await screen.findByRole('dialog');

    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Cartão principal');
    await userEvent.selectOptions(within(dialog).getByLabelText('Tipo'), 'credit_card');
    await userEvent.type(within(dialog).getByLabelText('Limite'), '800000');
    await userEvent.type(within(dialog).getByLabelText('Dia de fechamento'), '26');
    await userEvent.type(within(dialog).getByLabelText('Dia de vencimento'), '5');
    await userEvent.selectOptions(within(dialog).getByLabelText('Conta para pagar a fatura'), checking.id);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar conta' }));

    expect(api.post).toHaveBeenCalledWith(
      '/accounts',
      expect.objectContaining({
        name: 'Cartão principal', type: 'credit_card', initialBalance: 0,
        creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountId: checking.id,
      }),
    );
  });

  it('exige os campos do cartão antes de enviar', async () => {
    const api = fakeApi({ 'GET /accounts': [] });
    renderApp(<AccountsPage />, { api });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Nova conta' }))[0]!);
    const dialog = await screen.findByRole('dialog');

    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Cartão');
    await userEvent.selectOptions(within(dialog).getByLabelText('Tipo'), 'credit_card');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar conta' }));

    expect(await within(dialog).findByText('Informe o limite do cartão')).toBeInTheDocument();
    expect(within(dialog).getByText('Informe o dia de fechamento da fatura')).toBeInTheDocument();
    expect(within(dialog).getByText('Informe o dia de vencimento da fatura')).toBeInTheDocument();
    expect(within(dialog).getByText('Informe a conta usada para pagar a fatura')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('mostra limite disponível, usado e fatura aberta do cartão, com link para as faturas', async () => {
    const card = cardAccount();
    renderApp(<AccountsPage />, { api: fakeApi({ 'GET /accounts': [card] }) });
    const item = await screen.findByRole('article', { name: 'Cartão principal' });
    expect(item).toHaveTextContent(/Disponível R\$\s*7\.700,00 de R\$\s*8\.000,00/);
    expect(item).toHaveTextContent(/Usado R\$\s*300,00/);
    expect(item).toHaveTextContent(/Fatura aberta: R\$\s*300,00/);
    expect(within(item).getByRole('link', { name: 'Ver faturas' })).toHaveAttribute('href', '/cartoes/c1');
  });

  it('sem fatura aberta, não mostra a linha "Fatura aberta"', async () => {
    const card = cardAccount({ card: { limitAvailable: 800000, openInvoice: null, nextDue: null } });
    renderApp(<AccountsPage />, { api: fakeApi({ 'GET /accounts': [card] }) });
    const item = await screen.findByRole('article', { name: 'Cartão principal' });
    expect(item).not.toHaveTextContent('Fatura aberta');
  });

  it('edita cartão preenchendo os campos existentes e envia PATCH com os campos', async () => {
    const checking = account();
    const card = cardAccount();
    const api = fakeApi({ 'GET /accounts': [checking, card], 'PATCH /accounts/c1': card });
    renderApp(<AccountsPage />, { api });

    await userEvent.click(await screen.findByRole('button', { name: 'Editar Cartão principal' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Limite')).toHaveValue('8.000,00');
    expect(within(dialog).getByLabelText('Dia de fechamento')).toHaveValue(26);
    expect(within(dialog).getByLabelText('Dia de vencimento')).toHaveValue(5);
    expect(within(dialog).getByLabelText('Conta para pagar a fatura')).toHaveValue('a1');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar conta' }));
    expect(api.patch).toHaveBeenCalledWith(
      '/accounts/c1',
      expect.objectContaining({ creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountId: 'a1' }),
    );
  });

  it('ao editar um cartão, o tipo fica travado', async () => {
    const checking = account();
    const card = cardAccount();
    renderApp(<AccountsPage />, { api: fakeApi({ 'GET /accounts': [checking, card] }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Cartão principal' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Tipo')).toBeDisabled();
  });

  it('ao editar uma conta comum, "Cartão de crédito" não aparece entre os tipos', async () => {
    const checking = account();
    renderApp(<AccountsPage />, { api: fakeApi({ 'GET /accounts': [checking] }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Nubank' }));
    const dialog = await screen.findByRole('dialog');
    const typeSelect = within(dialog).getByLabelText('Tipo');
    expect(typeSelect).not.toBeDisabled();
    expect(within(typeSelect).queryByText('Cartão de crédito')).not.toBeInTheDocument();
  });

  it('a transferência não oferece cartões como origem nem destino', async () => {
    const checking = account();
    const card = cardAccount();
    renderApp(<AccountsPage />, { api: fakeApi({ 'GET /accounts': [checking, card] }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Transferir' }));
    const dialog = await screen.findByRole('dialog');
    const fromSelect = within(dialog).getByLabelText('De');
    const toSelect = within(dialog).getByLabelText('Para');
    expect(within(fromSelect).queryByText('Cartão principal')).not.toBeInTheDocument();
    expect(within(toSelect).queryByText('Cartão principal')).not.toBeInTheDocument();
  });
});
