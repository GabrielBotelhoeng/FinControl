import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeApi } from '../../test/fakes';
import { renderApp } from '../../test/render';
import LoanDetailPage from './loan-detail-page';

/** O financiamento da demo: R$ 30.000 em 48x de R$ 950, 12 pagas (critério 5), Banco do Brasil em 7º de 39. */
const detail = (over: Record<string, unknown> = {}) => ({
  id: 'l1', name: 'Financiamento do carro', kind: 'vehicle', bankName: 'BCO DO BRASIL S.A.', bankCnpj8: '00000000',
  principal: 3000000, installmentAmount: 95000, installmentsTotal: 48, installmentsPaid: 12,
  monthlyRate: 0.0185795, annualRate: 0.247209, outstanding: 2477608, nextDue: { date: '2026-12-01', amount: 95000 },
  totalCost: 4560000, interest: 1560000, paidAmount: 1140000, remainingCount: 36, payoffSavings: 942392,
  informedMonthlyRate: null, warnings: [],
  comparison: {
    modality: 'Aquisição de veículos - Prefixado', periodStart: '2026-10-23', periodEnd: '2026-10-29', source: 'Banco Central do Brasil',
    bank: { name: 'BCO DO BRASIL S.A.', monthlyRate: 0.0112, annualRate: 0.1425, position: 7, of: 39 },
    market: { monthlyRate: 0.017, annualRate: 0.2241 },
  },
  ...over,
});

function renderPage(client = fakeApi({ 'GET /loans/l1': detail() })) {
  renderApp(<LoanDetailPage />, { route: '/emprestimos/l1', path: '/emprestimos/:id', api: client, extraRoutes: { '/emprestimos': <p>Lista</p> } });
  return client;
}

describe('LoanDetailPage', () => {
  it('mostra a taxa real, a frase de custo e pago, falta e saldo devedor', async () => {
    renderPage();
    expect(await screen.findByText('Taxa real 1,86% ao mês · 24,72% ao ano')).toBeInTheDocument();
    expect(screen.getByText('Você pegou R$ 30.000,00 e vai devolver R$ 45.600,00; R$ 15.600,00 são juros.')).toBeInTheDocument();
    const numbers = screen.getByRole('group', { name: 'Situação do empréstimo' });
    expect(numbers).toHaveTextContent(/Pago\s*R\$\s*11\.400,00/);
    expect(numbers).toHaveTextContent(/Falta pagar\s*R\$\s*34\.200,00/);
    expect(numbers).toHaveTextContent('12 de 48 parcelas');
  });

  it('quitação antecipada estimada, rotulada como estimativa, com a economia e a base legal (C11)', async () => {
    renderPage();
    const payoff = await screen.findByRole('region', { name: 'Quitação antecipada' });
    expect(payoff).toHaveTextContent('Estimativa');
    expect(payoff).toHaveTextContent(/R\$\s*24\.776,08/);
    expect(payoff).toHaveTextContent(/economia de R\$\s*9\.423,92/);
    expect(payoff).toHaveTextContent('CDC art. 52 §2º');
  });

  it('compara com o banco e com a mediana do mercado, com fonte e período, e diz se está acima do mercado', async () => {
    renderPage();
    const box = await screen.findByRole('region', { name: 'Comparação com o mercado' });
    expect(box).toHaveTextContent('BCO DO BRASIL S.A.: 1,12% ao mês (7º de 39)');
    expect(box).toHaveTextContent('Mediana do mercado: 1,70% ao mês');
    expect(box).toHaveTextContent('Fonte: Banco Central do Brasil · período de 23/10/2026 a 29/10/2026');
    expect(box).toHaveTextContent('Acima do mercado');
  });

  it('taxa menor ou igual à mediana: "Dentro do mercado"; sem dados, explica', async () => {
    const first = renderApp(<LoanDetailPage />, {
      route: '/emprestimos/l1', path: '/emprestimos/:id', api: fakeApi({ 'GET /loans/l1': detail({ monthlyRate: 0.015 }) }),
    });
    expect(await screen.findByRole('region', { name: 'Comparação com o mercado' })).toHaveTextContent('Dentro do mercado');
    first.unmount();
    renderPage(fakeApi({ 'GET /loans/l1': detail({ comparison: null }) }));
    expect(await screen.findByText('Ainda não há taxas do Banco Central para comparar este tipo de crédito.')).toBeInTheDocument();
  });

  it('mostra os avisos por escrito', async () => {
    renderPage(fakeApi({ 'GET /loans/l1': detail({ warnings: ['informed_rate_differs', 'rate_too_high', 'sac_approximate'] }) }));
    expect(await screen.findByText('A taxa informada difere da calculada. Pode haver seguro ou tarifa embutida.')).toBeInTheDocument();
    expect(screen.getByText('Taxa acima de 30% ao mês. Confira os valores digitados.')).toBeInTheDocument();
    expect(screen.getByText('Financiamentos imobiliários costumam usar SAC; esta taxa é aproximada.')).toBeInTheDocument();
  });

  it('renomear envia o PATCH', async () => {
    const client = renderPage(fakeApi({ 'GET /loans/l1': detail(), 'PATCH /loans/l1': detail({ name: 'Carro' }) }));
    await userEvent.click(await screen.findByRole('button', { name: 'Renomear' }));
    const dialog = await screen.findByRole('dialog', { name: 'Renomear empréstimo' });
    await userEvent.clear(within(dialog).getByLabelText('Nome'));
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Carro');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    expect(client.patch).toHaveBeenCalledWith('/loans/l1', { name: 'Carro' });
  });

  it('excluir pede confirmação explicando o que acontece com as parcelas e envia o DELETE', async () => {
    const client = renderPage(fakeApi({ 'GET /loans/l1': detail(), 'DELETE /loans/l1': undefined }));
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir empréstimo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Excluir empréstimo?' });
    expect(dialog).toHaveTextContent('As parcelas pendentes serão apagadas. As já pagas continuam no histórico.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    expect(client.del).toHaveBeenCalledWith('/loans/l1');
  });
});
