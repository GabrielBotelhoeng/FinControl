import type { ReportDTO } from '@fincontrol/shared';
import { inflateSync } from 'node:zlib';
import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/app';
import { newUser, type TestUser } from './helpers/auth';
import { createDebtsReader } from '../src/modules/reports/debts';
import { resetDb, testDb } from './helpers/db';
import { categoryId, createAccount, createTransaction } from './helpers/factories';

const { app } = buildTestApp();

const report = async (user: TestUser, from: string, to: string) => {
  const res = await request(app).get(`/api/v1/reports?from=${from}&to=${to}`).set(user.auth);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body as ReportDTO;
};

/** Hoje é 2026-11-11. Outubro: R$ 4.000 de receita e R$ 2.000 de despesa; novembro: R$ 5.000 e R$ 3.000 (critério 1). */
async function scenario(user: TestUser) {
  const checking = await createAccount(app, user, { name: 'Corrente', initialBalance: 100000 });
  const savings = await createAccount(app, user, { name: 'Poupança', type: 'savings', initialBalance: 50000 });
  const salary = await categoryId(app, user, 'Salário', 'income');
  const food = await categoryId(app, user, 'Alimentação', 'expense');
  const home = await categoryId(app, user, 'Moradia', 'expense');
  const leisure = await categoryId(app, user, 'Lazer', 'expense');
  const paid = (type: 'income' | 'expense', amount: number, date: string, category: string, description: string) =>
    createTransaction(app, user, { type, amount, description, accountId: checking.id, categoryId: category, nature: 'variable', dueDate: date, status: 'paid', paidDate: date });

  await paid('income', 400000, '2026-10-01', salary, 'Salário outubro');
  await paid('expense', 150000, '2026-10-05', home, 'Aluguel');
  await paid('expense', 50000, '2026-10-12', food, 'Mercado outubro');
  await paid('income', 500000, '2026-11-01', salary, 'Salário novembro');
  await paid('expense', 200000, '2026-11-03', food, 'Mercado novembro');
  await paid('expense', 100000, '2026-11-08', leisure, 'Show');
  // Fora do relatório: pendente (R2) e transferência.
  await createTransaction(app, user, { type: 'expense', amount: 99900, description: 'Conta pendente', accountId: checking.id, categoryId: food, nature: 'variable', dueDate: '2026-11-20' });
  await createTransaction(app, user, {
    type: 'transfer', amount: 30000, description: 'Guardar', accountId: checking.id, destinationAccountId: savings.id,
    dueDate: '2026-11-09', status: 'paid', paidDate: '2026-11-09',
  });
  return { checking, savings, food };
}

/** Sub-projeto 14: despesas com tags em outubro e novembro, além de receita, pendente e transferência marcadas (fora de H1). */
async function taggedScenario(user: TestUser) {
  const base = await scenario(user);
  const { checking, savings, food } = base;
  const income = await categoryId(app, user, 'Salário', 'income');
  const paid = (type: 'income' | 'expense', amount: number, date: string, description: string, tags: string[], category = food) =>
    createTransaction(app, user, { type, amount, description, accountId: checking.id, categoryId: category, nature: 'variable', dueDate: date, status: 'paid', paidDate: date, tags });
  await paid('expense', 6000, '2026-10-20', 'Cerveja outubro', ['bebida']);
  await paid('expense', 8000, '2026-10-25', 'Presente', ['natal']);
  await paid('expense', 4000, '2026-11-04', 'Chopp', ['bar', 'bebida']);
  await paid('expense', 2000, '2026-11-05', 'Cerveja', ['bebida']);
  await paid('income', 1000, '2026-11-06', 'Venda de garrafas', ['bebida'], income);
  await createTransaction(app, user, { type: 'expense', amount: 9000, description: 'Vinho', accountId: checking.id, categoryId: food, nature: 'variable', dueDate: '2026-11-25', tags: ['bebida'] });
  await createTransaction(app, user, {
    type: 'transfer', amount: 5000, description: 'Caixinha da bebida', accountId: checking.id, destinationAccountId: savings.id,
    dueDate: '2026-11-07', status: 'paid', paidDate: '2026-11-07', tags: ['bebida'],
  });
  return base;
}

describe('relatórios', () => {
  beforeEach(resetDb);

  it('critério 1: totais do mês e comparação com o mês anterior; pendentes e transferências ficam de fora', async () => {
    const user = await newUser();
    await scenario(user);
    const r = await report(user, '2026-11', '2026-11');
    expect(r.period).toEqual({ from: '2026-11', to: '2026-11', months: 1, previousFrom: '2026-10', previousTo: '2026-10' });
    expect(r.totals).toEqual({
      income: 500000, expense: 300000, net: 200000, savingsRate: 0.4,
      previousIncome: 400000, previousExpense: 200000, incomeChange: 0.25, expenseChange: 0.5,
    });
  });

  it('categorias com participação e variação; a que só existiu no período anterior entra com total 0', async () => {
    const user = await newUser();
    await scenario(user);
    const r = await report(user, '2026-11', '2026-11');
    expect(r.expenseByCategory.map((c) => [c.name, c.total, c.previous, c.change])).toEqual([
      ['Alimentação', 200000, 50000, 3],
      ['Lazer', 100000, 0, null],
      ['Moradia', 0, 150000, -1],
    ]);
    expect(r.expenseByCategory[0]!.share).toBeCloseTo(2 / 3);
    expect(r.incomeByCategory).toEqual([expect.objectContaining({ name: 'Salário', total: 500000, share: 1, previous: 400000, change: 0.25 })]);
  });

  it('H1–H3 (sub-projeto 14): gastos por tag com o anterior; duas tags contam nas duas; receitas, pendentes e transferências ficam fora', async () => {
    const user = await newUser();
    await taggedScenario(user);
    const r = await report(user, '2026-11', '2026-11');
    expect(r.totals.expense).toBe(306000);
    expect(r.expenseByTag.map((t) => [t.name, t.total, t.count, t.previous, t.change])).toEqual([
      ['bebida', 6000, 2, 6000, 0],
      ['bar', 4000, 1, 0, null],
      ['natal', 0, 0, 8000, -1],
    ]);
    expect(r.expenseByTag[0]!.share).toBeCloseTo(6000 / 306000);
    expect(r.expenseByTag[2]!.share).toBe(0);
    // Só as despesas da própria pessoa.
    expect((await report(await newUser(), '2026-11', '2026-11')).expenseByTag).toEqual([]);
  });

  it('séries de no mínimo 6 meses (R4), maiores despesas e saldos no fim do período sem cartões', async () => {
    const user = await newUser();
    const { checking } = await scenario(user);
    await createAccount(app, user, { name: 'Cartão', type: 'credit_card', color: '#7c3aed', creditLimit: 100000, closingDay: 26, dueDay: 5, paymentAccountId: checking.id });
    const r = await report(user, '2026-11', '2026-11');
    expect(r.monthly.map((m) => m.month)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
    expect(r.monthly.at(-2)).toEqual({ month: '2026-10', income: 400000, expense: 200000, net: 200000 });
    expect(r.monthly.at(-1)).toEqual({ month: '2026-11', income: 500000, expense: 300000, net: 200000 });
    expect(r.topExpenses.map((e) => [e.description, e.amount, e.category])).toEqual([['Mercado novembro', 200000, 'Alimentação'], ['Show', 100000, 'Lazer']]);
    // Corrente: 1.000 + 4.000 − 2.000 + 5.000 − 3.000 − 300 = 4.700; Poupança: 500 + 300 = 800.
    expect(r.balances).toEqual({
      date: '2026-11-30',
      items: [
        expect.objectContaining({ name: 'Corrente', type: 'checking', balance: 470000 }),
        expect.objectContaining({ name: 'Poupança', type: 'savings', balance: 80000 }),
      ],
      total: 550000,
    });
  });

  it('saldo no fim de um período passado ignora o que veio depois', async () => {
    const user = await newUser();
    await scenario(user);
    const r = await report(user, '2026-10', '2026-10');
    expect(r.balances.items.find((b) => b.name === 'Corrente')!.balance).toBe(300000);
    expect(r.totals.previousIncome).toBe(0);
    expect(r.totals.incomeChange).toBeNull();
  });

  it('critérios 2 e 3: evolução das dívidas com compra parcelada, pagamento de fatura e empréstimo', async () => {
    const user = await newUser();
    const checking = await createAccount(app, user, { initialBalance: 500000 });
    const card = await createAccount(app, user, { type: 'credit_card', color: '#7c3aed', creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountId: checking.id });
    const food = await categoryId(app, user, 'Alimentação', 'expense');
    await createTransaction(app, user, { type: 'expense', amount: 120000, description: 'Notebook', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-10-27', installments: 12 });
    const pay = await request(app).post(`/api/v1/cards/${card.id}/invoices/2026-11/payments`).set(user.auth).send({ amount: 10000, accountId: checking.id, paidDate: '2026-11-10' });
    expect(pay.status).toBe(201);
    const loan = await request(app).post('/api/v1/loans').set(user.auth).send({
      name: 'Carro', kind: 'vehicle', bankName: 'BCO DO BRASIL S.A.', principal: 3000000, installmentAmount: 95000,
      installmentsTotal: 48, installmentsPaidBefore: 12, firstDueDate: '2025-12-10', accountId: checking.id,
    });
    const outstanding = (await request(app).get(`/api/v1/loans/${loan.body.id}`).set(user.auth)).body.outstanding as number;

    const r = await report(user, '2026-11', '2026-11');
    const at = (m: string) => r.debts.find((d) => d.month === m)!;
    expect(at('2026-09').cards).toBe(0);
    expect(at('2026-10').cards).toBe(120000);
    expect(at('2026-11')).toEqual({ month: '2026-11', cards: 110000, loans: outstanding, others: 0, total: 110000 + outstanding });
    // Em junho, 7 das 12 parcelas pagas antes do cadastro já tinham vencido (dez/25 a jun/26): o saldo era maior.
    expect(at('2026-06').loans).toBeGreaterThan(outstanding);
  });

  it('excluir a 1ª parcela não move a dívida da compra para o mês seguinte', async () => {
    const user = await newUser();
    const checking = await createAccount(app, user, { initialBalance: 500000 });
    const card = await createAccount(app, user, { type: 'credit_card', color: '#7c3aed', creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountId: checking.id });
    const food = await categoryId(app, user, 'Alimentação', 'expense');
    const purchase = await createTransaction(app, user, { type: 'expense', amount: 120000, description: 'Notebook', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-08-31', installments: 12 }) as unknown as { installments: { id: string }[] };
    const del = await request(app).delete(`/api/v1/transactions/${purchase.installments[0]!.id}`).set(user.auth);
    expect(del.status).toBe(204);
    const r = await report(user, '2026-11', '2026-11');
    expect(r.debts.find((d) => d.month === '2026-07')!.cards).toBe(0);
    expect(r.debts.find((d) => d.month === '2026-08')!.cards).toBe(110000);
    // Compra no dia 31: a parcela de setembro vence em 30/09 (dia cortado); a data da compra continua 31/08.
    const { cards } = await createDebtsReader(testDb).load(user.id);
    expect(new Set(cards[0]!.charges.map((c) => c.startDate))).toEqual(new Set(['2026-08-31']));
  });

  it('um ano inteiro: 11 meses até o mês atual, comparado com o mesmo tamanho antes', async () => {
    const user = await newUser();
    await scenario(user);
    const r = await report(user, '2026-01', '2026-11');
    expect(r.period).toMatchObject({ months: 11, previousFrom: '2025-02', previousTo: '2025-12' });
    expect(r.monthly).toHaveLength(11);
    expect(r.totals).toMatchObject({ income: 900000, expense: 500000 });
  });

  it('valida o período: formato e ordem dão 400; depois do mês atual dá 422', async () => {
    const user = await newUser();
    const get = (q: string) => request(app).get(`/api/v1/reports${q}`).set(user.auth);
    expect((await get('')).status).toBe(400);
    expect((await get('?from=2026-11&to=2026-10')).status).toBe(400);
    expect((await get('?from=2024-01&to=2026-01')).status).toBe(400);
    const future = await get('?from=2026-11&to=2026-12');
    expect(future.status).toBe(422);
    expect(future.body.detail).toBe('O relatório vai só até o mês atual.');
  });

  it('isolamento: outro usuário não vê nada', async () => {
    const owner = await newUser();
    await scenario(owner);
    const other = await newUser();
    const r = await report(other, '2026-11', '2026-11');
    expect(r.totals).toMatchObject({ income: 0, expense: 0, previousIncome: 0 });
    expect(r.expenseByCategory).toEqual([]);
    expect(r.topExpenses).toEqual([]);
    expect(r.balances).toEqual({ date: '2026-11-30', items: [], total: 0 });
    expect(r.debts.every((d) => d.total === 0)).toBe(true);
    expect((await request(app).get('/api/v1/reports?from=2026-11&to=2026-11')).status).toBe(401);
  });

  it('CSV (R9): BOM, ; e vírgula decimal, pagas e pendentes por competência, transferência e proteção contra fórmula', async () => {
    const user = await newUser();
    const { checking, food } = await scenario(user);
    await createTransaction(app, user, {
      type: 'expense', amount: 1050, description: '=SOMA(A1); "teste"', accountId: checking.id, categoryId: food, nature: 'variable',
      dueDate: '2026-10-30', status: 'paid', paidDate: '2026-11-02', tags: ['Bebida', 'bar'],
    });
    const res = await request(app).get('/api/v1/reports/export.csv?from=2026-11&to=2026-11').set(user.auth);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toBe('attachment; filename="fincontrol-lancamentos-2026-11.csv"');
    expect(res.text.startsWith('\uFEFF')).toBe(true);
    const lines = res.text.slice(1).trimEnd().split('\r\n');
    // Sub-projeto 14 (H6): "Tags" no fim, para as colunas antigas não mudarem de lugar.
    expect(lines[0]).toBe('Data;Descrição;Tipo;Categoria;Conta;Conta de destino;Situação;Valor;Tags');
    expect(lines.slice(1)).toEqual([
      '01/11/2026;Salário novembro;Receita;Salário;Corrente;;Paga;5000,00;',
      `02/11/2026;"'=SOMA(A1); ""teste""";Despesa;Alimentação;Corrente;;Paga;-10,50;bar, bebida`,
      '03/11/2026;Mercado novembro;Despesa;Alimentação;Corrente;;Paga;-2000,00;',
      '08/11/2026;Show;Despesa;Lazer;Corrente;;Paga;-1000,00;',
      '09/11/2026;Guardar;Transferência;;Corrente;Poupança;Paga;300,00;',
      '20/11/2026;Conta pendente;Despesa;Alimentação;Corrente;;Pendente;-999,00;',
    ]);
  });

  it('CSV: nome do arquivo com o intervalo, período validado e isolamento', async () => {
    const owner = await newUser();
    await scenario(owner);
    const other = await newUser();
    const res = await request(app).get('/api/v1/reports/export.csv?from=2026-01&to=2026-11').set(other.auth);
    expect(res.headers['content-disposition']).toBe('attachment; filename="fincontrol-lancamentos-2026-01_2026-11.csv"');
    expect(res.text.slice(1).trimEnd().split('\r\n')).toHaveLength(1);
    expect((await request(app).get('/api/v1/reports/export.csv?from=2026-12&to=2026-12').set(other.auth)).status).toBe(422);
  });

  it('PDF (R10): abre no pdf-lib, tem o resumo, as categorias, as dívidas e aguenta emoji na descrição', async () => {
    const user = await newUser();
    const { checking, food } = await scenario(user);
    await createTransaction(app, user, {
      type: 'expense', amount: 4200, description: 'Pizza 🍕 com amigos', accountId: checking.id, categoryId: food, nature: 'variable',
      dueDate: '2026-11-07', status: 'paid', paidDate: '2026-11-07', tags: ['amigos'],
    });
    const res = await request(app).get('/api/v1/reports/export.pdf?from=2026-11&to=2026-11').set(user.auth).buffer(true).parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe('attachment; filename="fincontrol-relatorio-2026-11.pdf"');
    const bytes = res.body as Buffer;
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(doc.getTitle()).toBe('Relatório financeiro — novembro de 2026');
    const text = pdfText(bytes);
    for (const piece of ['Relatório financeiro', 'Resumo', 'Gastos por categoria', 'Alimentação', 'Gastos por tag', '#amigos', 'Evolução das dívidas', 'Maiores despesas', 'Pizza  com amigos', 'Saldo das contas em 30/11/2026', 'Página 1 de']) {
      expect(text, piece).toContain(piece);
    }
    expect(text).toContain('R$\u00a05.000,00');
  });

  it('PDF de um período sem nada ainda sai, com os estados vazios', async () => {
    const user = await newUser();
    const res = await request(app).get('/api/v1/reports/export.pdf?from=2026-01&to=2026-11').set(user.auth).buffer(true).parse(binary);
    expect(res.status).toBe(200);
    const text = pdfText(res.body as Buffer);
    expect(text).toContain('janeiro a novembro de 2026');
    expect(text).toContain('Nada pago no período.');
    // H5: sem tags, a seção não aparece.
    expect(text).not.toContain('Gastos por tag');
    expect((await request(app).get('/api/v1/reports/export.pdf?from=2026-12&to=2026-12').set(user.auth)).status).toBe(422);
  });

  it('Excel (critérios 1 a 3): abas, Tabela com filtro, fórmulas e "Cerveja" agrupada', async () => {
    const user = await newUser();
    const { checking, food } = await scenario(user);
    const leisure = await categoryId(app, user, 'Lazer', 'expense');
    const beer = (description: string, amount: number, date: string) =>
      createTransaction(app, user, { type: 'expense', amount, description, accountId: checking.id, categoryId: leisure, nature: 'variable', dueDate: date, status: 'paid', paidDate: date, tags: ['bebida'] });
    await beer('Cerveja', 2000, '2026-11-01');
    await beer('Cerveja', 3000, '2026-11-07');
    await beer('CERVEJA', 2500, '2026-11-08');
    await beer('cerveja (2/3)', 1500, '2026-11-09');
    void food;

    const res = await request(app).get('/api/v1/reports/export.xlsx?from=2026-11&to=2026-11').set(user.auth).buffer(true).parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.headers['content-disposition']).toBe('attachment; filename="fincontrol-analise-2026-11.xlsx"');
    const wb = new ExcelJS.Workbook();
    // O tipo do exceljs pede o Buffer antigo do Node; o conteúdo é o mesmo.
    await wb.xlsx.load(res.body as Parameters<typeof wb.xlsx.load>[0]);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Resumo', 'Lançamentos', 'Por categoria', 'Por tag', 'Mensal', 'Ano contra ano', 'Onde o dinheiro vai', 'Dia da semana', 'Pequenos gastos', 'Fixos e variáveis', 'Dívidas', 'Saldos',
    ]);

    const lanc = wb.getWorksheet('Lançamentos')!;
    expect(lanc.getTable('Lancamentos')).toBeDefined();
    expect(lanc.getRow(1).values).toEqual([undefined, 'Data', 'Mês', 'Dia da semana', 'Descrição', 'Tipo', 'Categoria', 'Tags', 'Natureza', 'Conta', 'Conta de destino', 'Situação', 'Valor']);
    const firstBeer = lanc.getRows(2, lanc.rowCount - 1)!.find((r) => r.getCell(4).value === 'Cerveja')!;
    // O Valor passou para a 12ª coluna.
    expect([firstBeer.getCell(7).value, firstBeer.getCell(12).value]).toEqual(['bebida', -20]);

    // Sub-projeto 14 (H8): a tag com as vezes, o total, a variação e a média em fórmula.
    const tags = wb.getWorksheet('Por tag')!;
    const bebida = tags.getRows(4, tags.rowCount - 3)!.find((r) => r.getCell(1).value === '#bebida')!;
    expect([bebida.getCell(2).value, bebida.getCell(3).value, bebida.getCell(4).value]).toEqual([4, 90, 0]);
    // Sem valor anterior, a variação fica vazia (o exceljs não relê um resultado vazio).
    expect(bebida.getCell(5).value).toMatchObject({ formula: `IF(D${bebida.number}=0,"",(C${bebida.number}-D${bebida.number})/D${bebida.number})` });
    expect(bebida.getCell(6).value).toEqual({ formula: `C${bebida.number}/1`, result: 90 });

    const where = wb.getWorksheet('Onde o dinheiro vai')!;
    const beerRow = where.getRows(4, where.rowCount - 3)!.find((r) => r.getCell(1).value === 'Cerveja')!;
    expect([beerRow.getCell(2).value, beerRow.getCell(3).value, beerRow.getCell(5).value]).toEqual([4, 90, 'Lazer']);

    const cat = wb.getWorksheet('Por categoria')!;
    const food2 = cat.getRows(4, cat.rowCount - 3)!.find((r) => r.getCell(1).value === 'Alimentação')!;
    const variation = food2.getCell(4).value as { formula: string; result: number };
    expect(variation.formula).toBe(`IF(C${food2.number}=0,"",(B${food2.number}-C${food2.number})/C${food2.number})`);
    expect(variation.result).toBe(3);

    const resumo = wb.getWorksheet('Resumo')!;
    expect(resumo.getCell('B4').value).toBe(5000);
    expect((resumo.getCell('B6').value as { formula: string }).formula).toBe('B4-B5');
  });

  it('Excel de período maior que 12 meses não tem "Ano contra ano"; período validado', async () => {
    const user = await newUser();
    const res = await request(app).get('/api/v1/reports/export.xlsx?from=2025-01&to=2026-11').set(user.auth).buffer(true).parse(binary);
    const wb = new ExcelJS.Workbook();
    // O tipo do exceljs pede o Buffer antigo do Node; o conteúdo é o mesmo.
    await wb.xlsx.load(res.body as Parameters<typeof wb.xlsx.load>[0]);
    expect(wb.worksheets.map((w) => w.name)).not.toContain('Ano contra ano');
    // H8: sem tags, sem a aba.
    expect(wb.worksheets.map((w) => w.name)).not.toContain('Por tag');
    // Sem despesas nem contas, o total é 0 e não uma soma que incluiria a própria célula (referência circular).
    const totalRow = (name: string) => wb.getWorksheet(name)!.getRow(4);
    expect(totalRow('Por categoria').getCell(2).value).toBe(0);
    expect(totalRow('Saldos').getCell(2).value).toBe(0);
    expect((await request(app).get('/api/v1/reports/export.xlsx?from=2026-12&to=2026-12').set(user.auth)).status).toBe(422);
  });
});

/** Junta o corpo binário da resposta (o supertest só bufferiza texto e JSON por padrão). */
function binary(res: unknown, done: (err: Error | null, body: Buffer) => void) {
  // No Node, o "Response" que o superagent entrega ao parser é o stream da resposta HTTP.
  const stream = res as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (c: Buffer) => chunks.push(c));
  stream.on('end', () => done(null, Buffer.concat(chunks)));
}

/** Texto desenhado nas páginas: o pdf-lib grava cada trecho como `<hex> Tj` em WinAnsi, com as streams comprimidas. */
function pdfText(pdf: Buffer): string {
  const raw = pdf.toString('latin1');
  const pieces: string[] = [];
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const data = Buffer.from(m[1]!, 'latin1');
    let content: string;
    try {
      content = inflateSync(data).toString('latin1');
    } catch {
      content = data.toString('latin1');
    }
    for (const t of content.matchAll(/<([0-9A-Fa-f]*)> Tj/g)) pieces.push(winAnsi(Buffer.from(t[1]!, 'hex')));
  }
  return pieces.join('\n');
}

/** Latin-1 cobre os acentos; os extras do WinAnsi usados aqui são o travessão e as reticências. */
function winAnsi(bytes: Buffer): string {
  return [...bytes].map((b) => (b === 0x97 ? '—' : b === 0x96 ? '–' : b === 0x85 ? '…' : b === 0x95 ? '•' : String.fromCharCode(b))).join('');
}
