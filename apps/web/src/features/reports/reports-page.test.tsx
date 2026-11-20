import type { ReportDTO } from '@fincontrol/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api-client';
import { fakeApi } from '../../test/fakes';
import { renderApp } from '../../test/render';
import ReportsPage from './reports-page';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const months = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];

const reportFixture = (over: Partial<ReportDTO> = {}): ReportDTO => ({
  period: { from: '2026-11', to: '2026-11', months: 1, previousFrom: '2026-10', previousTo: '2026-10' },
  totals: { income: 500000, expense: 300000, net: 200000, savingsRate: 0.4, previousIncome: 400000, previousExpense: 200000, incomeChange: 0.25, expenseChange: 0.5 },
  expenseByCategory: [
    { categoryId: 'food', name: 'Alimentação', icon: 'utensils', color: '#f97316', total: 200000, share: 2 / 3, previous: 50000, change: 3, subcategories: [] },
    { categoryId: 'fun', name: 'Lazer', icon: 'party-popper', color: '#ec4899', total: 100000, share: 1 / 3, previous: 0, change: null, subcategories: [] },
    { categoryId: 'home', name: 'Moradia', icon: 'house', color: '#22c55e', total: 0, share: 0, previous: 150000, change: -1, subcategories: [] },
  ],
  incomeByCategory: [{ categoryId: 'salary', name: 'Salário', icon: 'wallet', color: '#16a34a', total: 500000, share: 1, previous: 400000, change: 0.25, subcategories: [] }],
  expenseByTag: [],
  monthly: months.map((month) => ({ month, income: 400000, expense: 200000, net: 200000 })),
  debts: months.map((month, i) => ({ month, cards: 10000 * i, loans: 2500000 - 10000 * i, others: 0, total: 2500000 })),
  topExpenses: [{ id: 't1', date: '2026-11-03', description: 'Mercado novembro', category: 'Alimentação', account: 'Corrente', amount: 200000 }],
  balances: { date: '2026-11-30', items: [{ accountId: 'a', name: 'Corrente', type: 'checking', balance: 470000 }], total: 470000 },
  ...over,
});

function api(report: ReportDTO | Error = reportFixture()) {
  return fakeApi({
    'GET /reports/export': () => new Blob(['conteúdo'], { type: 'text/csv' }),
    'GET /reports': report,
  });
}

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-17T15:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('critério 1: resumo com saldo, taxa de poupança e variação escrita contra o período anterior', async () => {
    const client = api();
    renderApp(<ReportsPage />, { api: client });
    const summary = await screen.findByRole('region', { name: 'Resumo do período' });
    expect(within(summary).getByRole('group', { name: 'Receitas' })).toHaveTextContent(/R\$\s*5\.000,00\s*\+25%\s*vs\. anterior/);
    expect(within(summary).getByRole('group', { name: 'Despesas' })).toHaveTextContent(/R\$\s*3\.000,00\s*\+50%/);
    expect(within(summary).getByRole('group', { name: 'Saldo do período' })).toHaveTextContent(/R\$\s*2\.000,00/);
    expect(within(summary).getByRole('group', { name: 'Taxa de poupança' })).toHaveTextContent('40%');
    expect(client.get).toHaveBeenCalledWith('/reports', { from: '2026-11', to: '2026-11' });
  });

  it('categorias com participação e variação; "novo" quando não havia valor antes', async () => {
    renderApp(<ReportsPage />, { api: api() });
    const list = await screen.findByRole('list', { name: 'Gastos por categoria' });
    expect(within(list).getByRole('listitem', { name: 'Alimentação' })).toHaveTextContent(/67% do total.*\+300%/);
    expect(within(list).getByRole('listitem', { name: 'Lazer' })).toHaveTextContent('novo');
    expect(within(list).getByRole('listitem', { name: 'Moradia' })).toHaveTextContent('-100%');
    expect(screen.getByRole('list', { name: 'Maiores despesas' })).toHaveTextContent(/Mercado novembro.*03\/11\/2026/);
    expect(screen.getByRole('region', { name: 'Saldo das contas' })).toHaveTextContent(/Saldo das contas em 30\/11\/2026.*Corrente.*R\$\s*4\.700,00/);
  });

  it('H4 (sub-projeto 14): gastos por tag com participação, quantidade, valor anterior e variação; sem tags, nada aparece', async () => {
    const withTags = reportFixture({
      expenseByTag: [
        { name: 'bebida', total: 6000, count: 2, share: 0.02, previous: 6000, change: 0 },
        { name: 'bar', total: 4000, count: 1, share: 4000 / 300000, previous: 0, change: null },
        { name: 'natal', total: 0, count: 0, share: 0, previous: 8000, change: -1 },
      ],
    });
    const { unmount } = renderApp(<ReportsPage />, { api: api(withTags) });
    const list = await screen.findByRole('list', { name: 'Gastos por tag' });
    expect(within(list).getAllByRole('listitem').map((li) => li.getAttribute('aria-label'))).toEqual(['#bebida', '#bar', '#natal']);
    expect(within(list).getByRole('listitem', { name: '#bebida' })).toHaveTextContent(/R\$\s*60,00.*2% das despesas · 2 lançamentos · antes R\$\s*60,00.*0%/);
    expect(within(list).getByRole('listitem', { name: '#bar' })).toHaveTextContent(/1 lançamento · antes.*novo/);
    expect(within(list).getByRole('listitem', { name: '#natal' })).toHaveTextContent('-100%');
    expect(screen.getByText(/Um lançamento com duas tags conta inteiro nas duas/)).toBeInTheDocument();
    unmount();

    renderApp(<ReportsPage />, { api: api() });
    await screen.findByRole('list', { name: 'Gastos por categoria' });
    expect(screen.queryByRole('heading', { name: 'Gastos por tag' })).not.toBeInTheDocument();
  });

  it('U7 (sub-projeto 15): o detalhe por subcategoria aparece embaixo da categoria, com o total e a variação', async () => {
    const report = reportFixture();
    report.expenseByCategory[0] = {
      ...report.expenseByCategory[0]!,
      subcategories: [
        { categoryId: 'rest', name: 'Restaurante', total: 150000, previous: 10000, change: 14 },
        { categoryId: null, name: 'Sem subcategoria', total: 50000, previous: 40000, change: 0.25 },
      ],
    };
    renderApp(<ReportsPage />, { api: api(report) });
    const subs = await screen.findByRole('list', { name: 'Subcategorias de Alimentação' });
    expect(within(subs).getByRole('listitem', { name: 'Restaurante' })).toHaveTextContent(/R\$\s*1\.500,00.*\+1\.400%/);
    expect(within(subs).getByRole('listitem', { name: 'Sem subcategoria' })).toHaveTextContent('+25%');
    expect(screen.queryByRole('list', { name: 'Subcategorias de Lazer' })).not.toBeInTheDocument();
  });

  it('os atalhos "Ano" e "12 meses" pedem o período certo, sem passar do mês atual', async () => {
    const client = api();
    const user = userEvent.setup();
    renderApp(<ReportsPage />, { api: client });
    await screen.findByRole('region', { name: 'Resumo do período' });
    await user.click(screen.getByRole('radio', { name: 'Ano' }));
    await waitFor(() => expect(client.get).toHaveBeenLastCalledWith('/reports', { from: '2026-01', to: '2026-11' }));
    expect(screen.getByRole('button', { name: 'Próximo ano' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Ano anterior' }));
    await waitFor(() => expect(client.get).toHaveBeenLastCalledWith('/reports', { from: '2025-01', to: '2025-12' }));
    await user.click(screen.getByRole('radio', { name: '12 meses' }));
    await waitFor(() => expect(client.get).toHaveBeenLastCalledWith('/reports', { from: '2025-12', to: '2026-11' }));
    await user.click(screen.getByRole('radio', { name: 'Mês' }));
    expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeDisabled();
  });

  it('estado vazio quando nada foi pago, mantendo os saldos', async () => {
    const empty = reportFixture({
      totals: { income: 0, expense: 0, net: 0, savingsRate: null, previousIncome: 0, previousExpense: 0, incomeChange: null, expenseChange: null },
      expenseByCategory: [],
      incomeByCategory: [],
      topExpenses: [],
    });
    renderApp(<ReportsPage />, { api: api(empty) });
    expect(await screen.findByText('Nada pago neste período')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Resumo do período' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Saldo das contas' })).toBeInTheDocument();
  });

  it('sem pagamentos agora, mas com gastos antes, a comparação continua visível', async () => {
    const onlyBefore = reportFixture({
      totals: { income: 0, expense: 0, net: 0, savingsRate: null, previousIncome: 0, previousExpense: 150000, incomeChange: null, expenseChange: -1 },
      expenseByCategory: [{ categoryId: 'home', name: 'Moradia', icon: 'house', color: '#22c55e', total: 0, share: 0, previous: 150000, change: -1, subcategories: [] }],
      incomeByCategory: [],
      topExpenses: [],
    });
    renderApp(<ReportsPage />, { api: api(onlyBefore) });
    expect(await screen.findByRole('listitem', { name: 'Moradia' })).toHaveTextContent('-100%');
    expect(screen.queryByText('Nada pago neste período')).not.toBeInTheDocument();
  });

  it('erro da API aparece com "Tentar de novo"', async () => {
    renderApp(<ReportsPage />, { api: api(new ApiError(500, 'Erro', 'Falhou ao carregar.')) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Falhou ao carregar.');
  });

  it('R11 e E10: "Baixar CSV", "Baixar PDF" e "Baixar Excel" buscam o arquivo pela API e salvam com o nome do período', async () => {
    const createObjectURL = vi.fn(() => 'blob:fake');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const names: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    const client = api();
    const user = userEvent.setup();
    renderApp(<ReportsPage />, { api: client });
    await user.click(await screen.findByRole('button', { name: 'Baixar CSV' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Lançamentos baixados.'));
    expect(client.download).toHaveBeenCalledWith('/reports/export.csv', { from: '2026-11', to: '2026-11' });
    await user.click(screen.getByRole('button', { name: 'Baixar PDF' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Relatório baixado.'));
    expect(client.download).toHaveBeenCalledWith('/reports/export.pdf', { from: '2026-11', to: '2026-11' });
    await user.click(screen.getByRole('button', { name: 'Baixar Excel' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Planilha de análise baixada.'));
    expect(client.download).toHaveBeenCalledWith('/reports/export.xlsx', { from: '2026-11', to: '2026-11' });
    expect(names).toEqual(['fincontrol-lancamentos-2026-11.csv', 'fincontrol-relatorio-2026-11.pdf', 'fincontrol-analise-2026-11.xlsx']);
    expect(createObjectURL).toHaveBeenCalledTimes(3);
    click.mockRestore();
  });

  it('falha no download mostra a mensagem da API e libera os botões', async () => {
    const client = fakeApi({
      'GET /reports/export': () => new ApiError(422, 'Não processável', 'O relatório vai só até o mês atual.'),
      'GET /reports': reportFixture(),
    });
    const user = userEvent.setup();
    renderApp(<ReportsPage />, { api: client });
    await user.click(await screen.findByRole('button', { name: 'Baixar PDF' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('O relatório vai só até o mês atual.'));
    expect(screen.getByRole('button', { name: 'Baixar PDF' })).toBeEnabled();
  });
});
