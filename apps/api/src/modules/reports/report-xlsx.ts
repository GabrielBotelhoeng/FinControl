import type { ReportDTO, YearMonth } from '@fincontrol/shared';
import ExcelJS from 'exceljs';
import type { aboveAverage, byDescription, byWeekday, fixedVsVariable, smallExpenses } from './report-analysis';
import type { CsvRow } from './reports.repository';

/**
 * Planilha de análise (spec da exportação em Excel, E1–E10). Valores em reais no arquivo (centavos ÷ 100), com o
 * formato de moeda do Excel; fórmulas onde a pessoa vai querer mexer, sempre com o resultado já gravado (E4).
 */
export type XlsxData = {
  report: ReportDTO;
  rows: CsvRow[];
  descriptions: ReturnType<typeof byDescription>;
  weekdays: ReturnType<typeof byWeekday>;
  small: ReturnType<typeof smallExpenses>;
  natures: ReturnType<typeof fixedVsVariable>;
  average: ReturnType<typeof aboveAverage>;
  /** Mês a mês contra o mesmo mês do ano anterior; `null` quando o período passa de 12 meses. */
  yearOverYear: { month: YearMonth; income: number; expense: number; previousIncome: number; previousExpense: number }[] | null;
};

const MONEY = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const PERCENT = '0%;[Red]-0%';
const DATE = 'dd/mm/yyyy';
// Verde-oliva da marca (cabeçalhos, com texto branco a 7:1) e limão claro nas abas (sub-projeto 16, L13).
const BRAND = 'FF3F6212';
const SOFT = 'FFEAF5C8';
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const TYPE = { income: 'Receita', expense: 'Despesa', transfer: 'Transferência' } as const;
const STATUS = { paid: 'Paga', pending: 'Pendente' } as const;
const NATURE = { fixed: 'Fixa', variable: 'Variável' } as const;

const reais = (cents: number) => cents / 100;
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]}/${ym.slice(0, 4)}`;
const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const weekday = (d: string) => WEEKDAYS[asDate(d).getUTCDay()]!;
/** Texto que começa com =, +, - ou @ ganha apóstrofo, como no CSV (R9): o Excel não o lê como fórmula. */
// O mesmo conjunto do CSV (`csvCell`): tab e CR no começo também abrem fórmula em algumas planilhas (auditoria final).
const safeText = (t: string) => (/^[=+\-@\t\r]/.test(t) ? `'${t}` : t);

type Col = { header: string; width: number; fmt?: string };

function sheet(wb: ExcelJS.Workbook, name: string, cols: Col[], note?: string) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: note ? 3 : 1 }] });
  ws.columns = cols.map((c) => ({ width: c.width, style: c.fmt ? { numFmt: c.fmt } : {} }));
  if (note) {
    ws.addRow([note]).font = { italic: true, color: { argb: 'FF5F6657' } };
    ws.addRow([]);
  }
  const header = ws.addRow(cols.map((c) => c.header));
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
  });
  return ws;
}

/** Fórmula com o resultado já gravado (E4). */
const formula = (f: string, result: number | string | null) => ({ formula: f, result: result ?? '' });

/** Soma das linhas de dados (a partir da 4ª); sem linhas, 0 — `SUM(B4:B3)` incluiria a própria célula do total (referência circular). */
const sumFrom4 = (col: string, end: number, result: number) => (end < 4 ? 0 : formula(`SUM(${col}4:${col}${end})`, result));

export async function renderReportXlsx(d: XlsxData, generatedAt: Date): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'FinControl';
  wb.created = generatedAt;
  // O Excel, o LibreOffice e o Google Planilhas recalculam tudo ao abrir: a fórmula nunca mostra um valor velho.
  wb.calcProperties.fullCalcOnLoad = true;
  const { report } = d;
  const { period, totals } = report;
  const label = period.from === period.to ? monthLabel(period.from) : `${monthLabel(period.from)} a ${monthLabel(period.to)}`;
  const previous = period.previousFrom === period.previousTo ? monthLabel(period.previousFrom) : `${monthLabel(period.previousFrom)} a ${monthLabel(period.previousTo)}`;

  // ---------- Resumo ----------
  const resumo = sheet(wb, 'Resumo', [{ header: 'Indicador', width: 28 }, { header: label, width: 18, fmt: MONEY }, { header: previous, width: 18, fmt: MONEY }, { header: 'Variação', width: 12, fmt: PERCENT }], `FinControl · análise de ${label}, comparada com ${previous}. Regime de caixa: só o que foi pago.`);
  const first = resumo.rowCount + 1;
  resumo.addRow(['Receitas', reais(totals.income), reais(totals.previousIncome), formula(`IF(C${first}=0,"",(B${first}-C${first})/C${first})`, totals.incomeChange)]);
  resumo.addRow(['Despesas', reais(totals.expense), reais(totals.previousExpense), formula(`IF(C${first + 1}=0,"",(B${first + 1}-C${first + 1})/C${first + 1})`, totals.expenseChange)]);
  resumo.addRow(['Saldo do período', formula(`B${first}-B${first + 1}`, reais(totals.net)), formula(`C${first}-C${first + 1}`, reais(totals.previousIncome - totals.previousExpense)), '']);
  const rate = resumo.addRow(['Taxa de poupança', formula(`IF(B${first}=0,"",(B${first}-B${first + 1})/B${first})`, totals.savingsRate), '', '']);
  rate.getCell(2).numFmt = PERCENT;
  resumo.addRow([]);
  const tagSheet = report.expenseByTag.length > 0 ? 'Por tag, ' : '';
  resumo.addRow([`Abas: Lançamentos (tabela com filtros), Por categoria, ${tagSheet}Mensal, Onde o dinheiro vai, Dia da semana, Pequenos gastos, Fixos e variáveis, Dívidas e Saldos.`]).font = { color: { argb: 'FF5F6657' } };

  // ---------- Lançamentos (Tabela do Excel, E3) ----------
  const lanc = wb.addWorksheet('Lançamentos', { views: [{ state: 'frozen', ySplit: 1 }] });
  const widths = [12, 10, 10, 34, 14, 22, 20, 20, 10, 18, 18, 10, 14];
  lanc.columns = widths.map((width) => ({ width }));
  lanc.addTable({
    name: 'Lancamentos',
    ref: 'A1',
    headerRow: true,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    // Sub-projetos 14 (H7) e 15 (U8): a subcategoria e as tags ao lado da categoria (a principal), para os filtros da Tabela.
    columns: ['Data', 'Mês', 'Dia da semana', 'Descrição', 'Tipo', 'Categoria', 'Subcategoria', 'Tags', 'Natureza', 'Conta', 'Conta de destino', 'Situação', 'Valor'].map((name) => ({ name, filterButton: true })),
    rows: d.rows.length
      ? d.rows.map((r) => [
          asDate(r.date), r.date.slice(0, 7), weekday(r.date), safeText(r.description), TYPE[r.type], safeText(r.category ?? ''), safeText(r.subcategory ?? ''), safeText(r.tags.join(', ')),
          r.nature ? NATURE[r.nature] : '',
          safeText(r.account), safeText(r.destination ?? ''), STATUS[r.status], reais(r.type === 'expense' ? -r.amount : r.amount),
        ])
      : [['', '', '', 'Nenhum lançamento no período', '', '', '', '', '', '', '', '', 0]],
  });
  lanc.getColumn(1).numFmt = DATE;
  lanc.getColumn(13).numFmt = MONEY;

  // ---------- Por categoria (variação em fórmula + antes e agora, E4 e E6) ----------
  const cat = sheet(wb, 'Por categoria', [
    { header: 'Categoria', width: 26 }, { header: 'Total no período', width: 17, fmt: MONEY }, { header: 'Período anterior', width: 17, fmt: MONEY },
    { header: 'Variação', width: 11, fmt: PERCENT }, { header: 'Média por mês', width: 15, fmt: MONEY }, { header: 'Média dos 3 meses antes', width: 22, fmt: MONEY },
    { header: 'Antes × agora', width: 14, fmt: PERCENT }, { header: 'Atenção', width: 18 },
  ], 'Despesas pagas. "Antes × agora" compara a média por mês do período com a dos 3 meses anteriores ao início; acima de 20% ganha destaque.');
  const averages = new Map(d.average.map((a) => [a.category, a]));
  const names = [...new Set([...report.expenseByCategory.map((c) => c.name), ...d.average.map((a) => a.category)])];
  for (const name of names) {
    const c = report.expenseByCategory.find((x) => x.name === name);
    const a = averages.get(name);
    const n = cat.rowCount + 1;
    const row = cat.addRow([
      safeText(name), reais(c?.total ?? 0), reais(c?.previous ?? 0), formula(`IF(C${n}=0,"",(B${n}-C${n})/C${n})`, c?.change ?? null),
      reais(a?.monthly ?? 0), reais(a?.previousMonthly ?? 0), formula(`IF(F${n}=0,"",(E${n}-F${n})/F${n})`, a?.change ?? null),
      a?.highlight ? 'Subiu mais de 20%' : '',
    ]);
    if (a?.highlight) row.getCell(8).font = { bold: true, color: { argb: 'FFD23752' } };
  }
  const catEnd = cat.rowCount;
  const catTotal = cat.addRow(['Total', sumFrom4('B', catEnd, reais(totals.expense)), sumFrom4('C', catEnd, reais(totals.previousExpense)), '', '', '', '', '']);
  catTotal.font = { bold: true };

  // ---------- Por tag (sub-projeto 14, H8): só quando há tags; sem linha de total, porque as tags se sobrepõem (H2) ----------
  if (report.expenseByTag.length > 0) {
    const tags = sheet(wb, 'Por tag', [
      { header: 'Tag', width: 24 }, { header: 'Vezes', width: 8 }, { header: 'Total no período', width: 17, fmt: MONEY }, { header: 'Período anterior', width: 17, fmt: MONEY },
      { header: 'Variação', width: 11, fmt: PERCENT }, { header: 'Média por mês', width: 15, fmt: MONEY }, { header: 'Participação nas despesas', width: 24, fmt: PERCENT },
    ], 'Despesas pagas com a tag. Um lançamento com duas tags conta inteiro nas duas, por isso as tags podem somar mais que o total de despesas.');
    for (const t of report.expenseByTag) {
      const n = tags.rowCount + 1;
      tags.addRow([
        `#${t.name}`, t.count, reais(t.total), reais(t.previous), formula(`IF(D${n}=0,"",(C${n}-D${n})/D${n})`, t.change),
        formula(`C${n}/${period.months}`, reais(t.total) / period.months), t.share,
      ]);
    }
  }

  // ---------- Mensal (E4) ----------
  const men = sheet(wb, 'Mensal', [{ header: 'Mês', width: 12 }, { header: 'Receitas', width: 16, fmt: MONEY }, { header: 'Despesas', width: 16, fmt: MONEY }, { header: 'Saldo do mês', width: 16, fmt: MONEY }, { header: 'Taxa de poupança', width: 17, fmt: PERCENT }]);
  for (const m of report.monthly) {
    const n = men.rowCount + 1;
    men.addRow([monthLabel(m.month), reais(m.income), reais(m.expense), formula(`B${n}-C${n}`, reais(m.net)), formula(`IF(B${n}=0,"",(B${n}-C${n})/B${n})`, m.income ? (m.income - m.expense) / m.income : null)]);
  }

  // ---------- Ano contra ano ----------
  if (d.yearOverYear) {
    const yoy = sheet(wb, 'Ano contra ano', [
      { header: 'Mês', width: 12 }, { header: 'Despesas', width: 16, fmt: MONEY }, { header: 'Um ano antes', width: 16, fmt: MONEY }, { header: 'Variação', width: 11, fmt: PERCENT },
      { header: 'Receitas', width: 16, fmt: MONEY }, { header: 'Um ano antes', width: 16, fmt: MONEY }, { header: 'Variação', width: 11, fmt: PERCENT },
    ], 'Cada mês do período contra o mesmo mês do ano anterior.');
    for (const m of d.yearOverYear) {
      const n = yoy.rowCount + 1;
      yoy.addRow([
        monthLabel(m.month), reais(m.expense), reais(m.previousExpense), formula(`IF(C${n}=0,"",(B${n}-C${n})/C${n})`, m.previousExpense ? (m.expense - m.previousExpense) / m.previousExpense : null),
        reais(m.income), reais(m.previousIncome), formula(`IF(F${n}=0,"",(E${n}-F${n})/F${n})`, m.previousIncome ? (m.income - m.previousIncome) / m.previousIncome : null),
      ]);
    }
  }

  // ---------- Onde o dinheiro vai (E5) ----------
  const where = sheet(wb, 'Onde o dinheiro vai', [
    { header: 'Descrição', width: 32 }, { header: 'Vezes', width: 8 }, { header: 'Total', width: 16, fmt: MONEY }, { header: 'Média', width: 14, fmt: MONEY },
    { header: 'Categoria', width: 22 }, { header: 'Última vez', width: 12, fmt: DATE },
  ], 'Despesas pagas agrupadas pela descrição (sem acento, maiúsculas nem número de parcela). As 50 maiores.');
  for (const r of d.descriptions) where.addRow([safeText(r.label), r.count, reais(r.total), reais(r.average), safeText(r.category), asDate(r.lastDate)]);

  // ---------- Dia da semana (E7) ----------
  const week = sheet(wb, 'Dia da semana', [{ header: 'Dia', width: 14 }, { header: 'Vezes', width: 8 }, { header: 'Total', width: 16, fmt: MONEY }, { header: 'Média por compra', width: 17, fmt: MONEY }], 'Despesas pagas. Embaixo, a média por dia: o fim de semana tem 2 dias e os dias úteis 5.');
  for (const day of d.weekdays.days) week.addRow([day.weekday, day.count, reais(day.total), reais(day.average)]);
  week.addRow([]);
  const wh = week.addRow(['', 'Dias', 'Total', 'Por dia']);
  wh.font = { bold: true };
  week.addRow(['Fim de semana', d.weekdays.weekend.days, reais(d.weekdays.weekend.total), reais(d.weekdays.weekend.perDay)]);
  week.addRow(['Dias úteis', d.weekdays.weekdays.days, reais(d.weekdays.weekdays.total), reais(d.weekdays.weekdays.perDay)]);

  // ---------- Pequenos gastos (E8) ----------
  const small = sheet(wb, 'Pequenos gastos', [{ header: 'Categoria', width: 26 }, { header: 'Vezes', width: 8 }, { header: 'Total', width: 16, fmt: MONEY }], 'Despesas pagas abaixo de R$ 50. Cada uma parece pouco; a soma, não.');
  for (const r of d.small.items) small.addRow([safeText(r.category), r.count, reais(r.total)]);
  small.addRow([]);
  small.addRow(['Total no período', d.small.count, reais(d.small.total)]).font = { bold: true };
  small.addRow(['Média por mês', '', reais(d.small.perMonth)]).font = { bold: true };

  // ---------- Fixos e variáveis (E9) ----------
  const nat = sheet(wb, 'Fixos e variáveis', [{ header: 'Natureza', width: 18 }, { header: 'Total', width: 16, fmt: MONEY }, { header: 'Participação', width: 13, fmt: PERCENT }], 'Despesas pagas. As variáveis são as que dá para cortar mais rápido.');
  for (const r of d.natures) nat.addRow([r.nature, reais(r.total), r.share]);

  // ---------- Dívidas e Saldos ----------
  const debt = sheet(
    wb, 'Dívidas',
    [{ header: 'Mês', width: 12 }, { header: 'Cartões', width: 16, fmt: MONEY }, { header: 'Empréstimos', width: 16, fmt: MONEY }, { header: 'Credores', width: 16, fmt: MONEY }, { header: 'Total', width: 16, fmt: MONEY }],
    'Saldo no fim de cada mês: cartões com parcelas futuras, saldo devedor dos empréstimos e dívidas com credores.',
  );
  for (const m of report.debts) {
    const n = debt.rowCount + 1;
    debt.addRow([monthLabel(m.month), reais(m.cards), reais(m.loans), reais(m.others), formula(`B${n}+C${n}+D${n}`, reais(m.total))]);
  }
  const bal = sheet(wb, 'Saldos', [{ header: 'Conta', width: 28 }, { header: 'Saldo', width: 16, fmt: MONEY }], `Saldo das contas ativas, sem cartões, no fim do período. Útil para a ficha "Bens e Direitos" do IR.`);
  for (const b of report.balances.items) bal.addRow([safeText(b.name), reais(b.balance)]);
  const balEnd = bal.rowCount;
  bal.addRow(['Total', sumFrom4('B', balEnd, reais(report.balances.total))]).font = { bold: true };

  for (const ws of wb.worksheets) {
    if (ws.name === 'Lançamentos') continue;
    ws.getRow(1).getCell(1).alignment = { wrapText: false };
    ws.properties.tabColor = { argb: ws.name === 'Resumo' ? BRAND : SOFT };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
