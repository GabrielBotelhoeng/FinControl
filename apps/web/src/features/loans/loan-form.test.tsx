import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeApi } from '../../test/fakes';
import { renderApp } from '../../test/render';
import { LoanForm } from './loan-form';

const checking = {
  id: 'a1', name: 'Conta corrente', type: 'checking', color: '#2563eb', initialBalance: 0, balance: 500000, archivedAt: null,
  createdAt: '2026-01-01T00:00:00Z', creditLimit: null, closingDay: null, dueDay: null, paymentAccountId: null, card: null,
};
const card = { ...checking, id: 'c1', name: 'Cartão', type: 'credit_card' };

function api(over: Record<string, unknown> = {}) {
  return fakeApi({
    'GET /accounts': [checking, card],
    'GET /banks': [{ cnpj8: '00000000', name: 'BCO DO BRASIL S.A.' }],
    'POST /loans': (_p: string, body: unknown) => ({ id: 'l1', ...(body as object) }),
    ...over,
  });
}

async function open(client = api()) {
  renderApp(<LoanForm open onOpenChange={() => {}} />, { api: client });
  const dialog = await screen.findByRole('dialog', { name: 'Novo empréstimo' });
  await within(dialog).findByRole('option', { name: 'Conta corrente' });
  return dialog;
}

async function fillCriterio4(dialog: HTMLElement) {
  await userEvent.type(within(dialog).getByLabelText('Nome'), 'Empréstimo pessoal');
  await userEvent.type(within(dialog).getByLabelText('Valor recebido'), '1000000');
  await userEvent.type(within(dialog).getByLabelText('Valor da parcela'), '60000');
  await userEvent.clear(within(dialog).getByLabelText('Número de parcelas'));
  await userEvent.type(within(dialog).getByLabelText('Número de parcelas'), '24');
}

describe('LoanForm', () => {
  it('tem os campos do cadastro, os 7 tipos e só contas que não são cartão para pagar', async () => {
    const dialog = await open();
    for (const label of ['Nome', 'Tipo', 'Banco', 'Valor recebido', 'Valor da parcela', 'Número de parcelas', 'Parcelas já pagas', 'Vencimento da 1ª parcela', 'Conta que paga', 'Taxa informada (opcional)']) {
      expect(within(dialog).getByLabelText(label)).toBeInTheDocument();
    }
    expect(within(within(dialog).getByLabelText('Tipo')).getAllByRole('option')).toHaveLength(7);
    const payer = within(dialog).getByLabelText('Conta que paga');
    expect(within(payer).queryByRole('option', { name: 'Cartão' })).not.toBeInTheDocument();
  });

  it('a prévia mostra a taxa real e quanto são juros (critério 4)', async () => {
    const dialog = await open();
    await fillCriterio4(dialog);
    expect(within(dialog).getByText('Taxa real: 3,15% ao mês (45,07% ao ano)')).toBeInTheDocument();
    expect(within(dialog).getByText('Você recebeu R$ 10.000,00 e vai devolver R$ 14.400,00. R$ 4.400,00 são juros.')).toBeInTheDocument();
  });

  it('envia o POST com centavos, banco escolhido na busca e a taxa informada como fração', async () => {
    const client = api();
    const dialog = await open(client);
    await fillCriterio4(dialog);
    await userEvent.type(within(dialog).getByLabelText('Banco'), 'brasil');
    await userEvent.click(await within(dialog).findByRole('button', { name: 'BCO DO BRASIL S.A.' }));
    await userEvent.type(within(dialog).getByLabelText('Taxa informada (opcional)'), '2,5');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar empréstimo' }));
    expect(client.post).toHaveBeenCalledWith(
      '/loans',
      expect.objectContaining({
        name: 'Empréstimo pessoal', kind: 'personal', bankName: 'BCO DO BRASIL S.A.', bankCnpj8: '00000000',
        principal: 1000000, installmentAmount: 60000, installmentsTotal: 24, installmentsPaidBefore: 0,
        accountId: 'a1', informedMonthlyRate: 0.025,
      }),
    );
  });

  it('se as contas não carregam, mostra o erro com "Tentar de novo" em vez de pedir para cadastrar uma conta', async () => {
    renderApp(<LoanForm open onOpenChange={() => {}} />, { api: api({ 'GET /accounts': new Error('Falha ao carregar as contas.') }) });
    const dialog = await screen.findByRole('dialog', { name: 'Novo empréstimo' });
    expect(await within(dialog).findByText('Falha ao carregar as contas.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /tentar/i })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar empréstimo' }));
    expect(within(dialog).queryByText(/Cadastre uma conta/)).not.toBeInTheDocument();
  });

  it('pendência: parcelas somando menos que o recebido mostra "sem juros", não juros negativos', async () => {
    const dialog = await open();
    await userEvent.type(within(dialog).getByLabelText('Valor recebido'), '10000');
    await userEvent.type(within(dialog).getByLabelText('Valor da parcela'), '400');
    await userEvent.type(within(dialog).getByLabelText('Número de parcelas'), '24');
    expect(within(dialog).getByText('Você recebeu R$ 100,00 e vai devolver R$ 96,00: sem juros.')).toBeInTheDocument();
  });

  it('banco fora da lista: aceita o nome digitado, sem CNPJ', async () => {
    const client = api({ 'GET /banks': [] });
    const dialog = await open(client);
    await fillCriterio4(dialog);
    await userEvent.type(within(dialog).getByLabelText('Banco'), 'Cooperativa Local');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar empréstimo' }));
    const [, body] = client.post.mock.calls.at(-1) as [string, Record<string, unknown>];
    expect(body).toMatchObject({ bankName: 'Cooperativa Local' });
    expect(body).not.toHaveProperty('bankCnpj8');
    expect(body).not.toHaveProperty('informedMonthlyRate');
  });
});
