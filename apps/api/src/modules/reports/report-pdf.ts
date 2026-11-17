import { formatBRL, pdfSafe, todayInSaoPaulo, type ReportCategoryDTO, type ReportDTO } from '@fincontrol/shared';
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';

/**
 * Relatório em PDF (spec do sub-projeto 4, R7 e R10). A4, Helvetica padrão (WinAnsi) — todo texto passa por
 * `pdfSafe`. Cores do tema claro do DESIGN.md: dourado para destaque, verde para receitas, vermelho para despesas.
 */

const PAGE: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const WIDTH = PAGE[0] - MARGIN * 2;
const BOTTOM = 56;

const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = {
  text: hex('#10121A'), muted: hex('#5A6072'), border: hex('#E0E1E8'), soft: hex('#EFEFF4'),
  primary: hex('#8A5A00'), primarySoft: hex('#F7EDD8'), income: hex('#0A8754'), expense: hex('#D23752'), debt: hex('#7C3AED'),
};

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const monthName = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1]!;
const shortMonth = (ym: string) => `${SHORT[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`;
const brDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** "novembro de 2026" ou "janeiro a novembro de 2026" ou "dezembro de 2025 a novembro de 2026". */
export function periodLabel(from: string, to: string): string {
  if (from === to) return `${monthName(from)} de ${from.slice(0, 4)}`;
  if (from.slice(0, 4) === to.slice(0, 4)) return `${monthName(from)} a ${monthName(to)} de ${to.slice(0, 4)}`;
  return `${monthName(from)} de ${from.slice(0, 4)} a ${monthName(to)} de ${to.slice(0, 4)}`;
}

const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
const signedPercent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0, signDisplay: 'exceptZero' });
const change = (c: number | null) => (c === null ? 'novo' : signedPercent.format(c));

type Align = 'left' | 'right';
type Column = { label: string; width: number; align?: Align };

export async function renderReportPdf(report: ReportDTO, generatedAt: Date): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const title = `Relatório financeiro — ${periodLabel(report.period.from, report.period.to)}`;
  doc.setTitle(pdfSafe(title));
  doc.setAuthor('FinControl');
  doc.setCreator('FinControl');
  doc.setProducer('FinControl');
  doc.setCreationDate(generatedAt);
  doc.setModificationDate(generatedAt);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage(PAGE);
  let y = PAGE[1] - MARGIN;

  const fit = (text: string, font: PDFFont, size: number, max: number) => {
    let t = pdfSafe(text);
    if (font.widthOfTextAtSize(t, size) <= max) return t;
    while (t.length > 0 && font.widthOfTextAtSize(`${t}…`, size) > max) t = t.slice(0, -1);
    return `${t.trimEnd()}…`;
  };
  const text = (s: string, x: number, at: number, o: { font?: PDFFont; size?: number; color?: RGB; width?: number; align?: Align } = {}) => {
    const font = o.font ?? regular;
    const size = o.size ?? 9;
    const t = o.width ? fit(s, font, size, o.width) : pdfSafe(s);
    const dx = o.align === 'right' && o.width ? o.width - font.widthOfTextAtSize(t, size) : 0;
    page.drawText(t, { x: x + dx, y: at, size, font, color: o.color ?? C.text });
  };
  const ensure = (height: number) => {
    if (y - height >= BOTTOM) return;
    page = doc.addPage(PAGE);
    y = PAGE[1] - MARGIN;
  };
  const heading = (label: string, note?: string) => {
    // Título, nota e o começo do que vem embaixo (cabeçalho + 1ª linha de tabela): nunca deixa o título sozinho no pé da página.
    ensure(50 + 32);
    y -= 26;
    text(label, MARGIN, y, { font: bold, size: 13 });
    if (note) text(note, MARGIN, y - 13, { size: 8, color: C.muted });
    y -= note ? 24 : 12;
  };
  /** `onRow` desenha extras (as barras) na mesma página da linha, com o `y` do topo dela. */
  const table = (columns: Column[], rows: string[][], o: { colors?: (RGB | undefined)[][]; boldLast?: boolean; onRow?: (i: number, top: number) => void } = {}) => {
    const rowHeight = 16;
    const header = () => {
      let x = MARGIN;
      for (const c of columns) {
        text(c.label, x, y - 11, { font: bold, size: 8, color: C.muted, width: c.width - 6, align: c.align });
        x += c.width;
      }
      y -= rowHeight;
      page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + WIDTH, y }, thickness: 0.6, color: C.border });
    };
    ensure(rowHeight * 2);
    header();
    rows.forEach((row, i) => {
      if (y - rowHeight < BOTTOM) {
        ensure(rowHeight * 2);
        header();
      }
      let x = MARGIN;
      const isLast = o.boldLast && i === rows.length - 1;
      row.forEach((cell, j) => {
        const c = columns[j]!;
        text(cell, x, y - 11, { width: c.width - 6, align: c.align, color: o.colors?.[i]?.[j], font: isLast ? bold : regular });
        x += c.width;
      });
      o.onRow?.(i, y);
      y -= rowHeight;
      page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + WIDTH, y }, thickness: 0.3, color: C.soft });
    });
  };
  const empty = (message: string) => {
    ensure(20);
    text(message, MARGIN, y - 12, { color: C.muted });
    y -= 20;
  };

  // ---------- Cabeçalho ----------
  page.drawRectangle({ x: 0, y: PAGE[1] - 6, width: PAGE[0], height: 6, color: C.primary });
  text('FinControl', MARGIN, y - 4, { font: bold, size: 10, color: C.primary });
  text(`Gerado em ${brDate(todayInSaoPaulo(generatedAt))}`, MARGIN, y - 4, { size: 8, color: C.muted, width: WIDTH, align: 'right' });
  y -= 30;
  text('Relatório financeiro', MARGIN, y, { font: bold, size: 22 });
  y -= 18;
  const { period } = report;
  text(
    `${periodLabel(period.from, period.to)} · comparado com ${periodLabel(period.previousFrom, period.previousTo)}`,
    MARGIN, y, { size: 10, color: C.muted, width: WIDTH },
  );

  // ---------- Resumo ----------
  heading('Resumo');
  const t = report.totals;
  const boxes: { label: string; value: string; detail: string; color: RGB }[] = [
    { label: 'Receitas', value: formatBRL(t.income), detail: `${change(t.incomeChange)} vs. anterior`, color: C.income },
    { label: 'Despesas', value: formatBRL(t.expense), detail: `${change(t.expenseChange)} vs. anterior`, color: C.expense },
    { label: 'Saldo do período', value: formatBRL(t.net), detail: 'Receitas - despesas', color: t.net < 0 ? C.expense : C.text },
    { label: 'Taxa de poupança', value: t.savingsRate === null ? '-' : percent.format(t.savingsRate), detail: 'Meta: 20% da renda', color: C.primary },
  ];
  const gap = 10;
  const boxWidth = (WIDTH - gap * 3) / 4;
  ensure(64);
  boxes.forEach((b, i) => {
    const x = MARGIN + i * (boxWidth + gap);
    page.drawRectangle({ x, y: y - 58, width: boxWidth, height: 58, color: C.soft, borderColor: C.border, borderWidth: 0.5 });
    text(b.label, x + 8, y - 15, { size: 8, color: C.muted, width: boxWidth - 16 });
    text(b.value, x + 8, y - 33, { font: bold, size: 12, color: b.color, width: boxWidth - 16 });
    text(b.detail, x + 8, y - 49, { size: 7.5, color: C.muted, width: boxWidth - 16 });
  });
  y -= 64;

  // ---------- Categorias ----------
  const categories = (label: string, rows: ReportCategoryDTO[], color: RGB) => {
    heading(label, 'Participação no período e variação contra o período anterior.');
    if (rows.length === 0) return empty('Nada pago no período.');
    const columns: Column[] = [
      { label: 'Categoria', width: 145 }, { label: '', width: 95 }, { label: 'Total', width: 80, align: 'right' },
      { label: 'Part.', width: 42, align: 'right' }, { label: 'Anterior', width: 80, align: 'right' }, { label: 'Var.', width: WIDTH - 442, align: 'right' },
    ];
    const barX = MARGIN + 145;
    const barWidth = 85;
    table(
      columns,
      rows.map((r) => [r.name, '', formatBRL(r.total), percent.format(r.share), formatBRL(r.previous), change(r.change)]),
      {
        onRow: (i, top) => {
          const share = rows[i]!.share;
          page.drawRectangle({ x: barX, y: top - 11, width: barWidth, height: 7, color: C.soft });
          if (share > 0) page.drawRectangle({ x: barX, y: top - 11, width: Math.max(barWidth * share, 1.5), height: 7, color });
        },
      },
    );
  };
  categories('Gastos por categoria', report.expenseByCategory, C.expense);
  categories('Receitas por categoria', report.incomeByCategory, C.income);

  // ---------- Evolução mensal (gráfico de barras + tabela) ----------
  const chartHeight = 110;
  // Título e gráfico juntos: sem isso, o título podia ficar no pé de uma página e o gráfico ir para a seguinte.
  ensure(50 + chartHeight + 30);
  heading('Evolução mensal', 'Receitas e despesas pagas em cada mês.');
  ensure(chartHeight + 30);
  const max = Math.max(1, ...report.monthly.flatMap((m) => [m.income, m.expense]));
  const slot = WIDTH / report.monthly.length;
  const barWidth = Math.min(14, slot / 3);
  const base = y - chartHeight;
  page.drawLine({ start: { x: MARGIN, y: base }, end: { x: MARGIN + WIDTH, y: base }, thickness: 0.6, color: C.border });
  report.monthly.forEach((m, i) => {
    const cx = MARGIN + slot * i + slot / 2;
    const hIncome = (m.income / max) * (chartHeight - 12);
    const hExpense = (m.expense / max) * (chartHeight - 12);
    if (hIncome > 0) page.drawRectangle({ x: cx - barWidth - 1, y: base, width: barWidth, height: hIncome, color: C.income });
    if (hExpense > 0) page.drawRectangle({ x: cx + 1, y: base, width: barWidth, height: hExpense, color: C.expense });
    const label = shortMonth(m.month);
    page.drawText(label, { x: cx - regular.widthOfTextAtSize(label, 7) / 2, y: base - 10, size: 7, font: regular, color: C.muted });
  });
  y = base - 16;
  page.drawRectangle({ x: MARGIN, y: y - 6, width: 8, height: 6, color: C.income });
  text('Receitas', MARGIN + 12, y - 6, { size: 8, color: C.muted });
  page.drawRectangle({ x: MARGIN + 64, y: y - 6, width: 8, height: 6, color: C.expense });
  text('Despesas', MARGIN + 76, y - 6, { size: 8, color: C.muted });
  y -= 14;
  table(
    [{ label: 'Mês', width: 120 }, { label: 'Receitas', width: 125, align: 'right' }, { label: 'Despesas', width: 125, align: 'right' }, { label: 'Saldo do mês', width: WIDTH - 370, align: 'right' }],
    report.monthly.map((m) => [`${monthName(m.month)} de ${m.month.slice(0, 4)}`, formatBRL(m.income), formatBRL(m.expense), formatBRL(m.net)]),
    { colors: report.monthly.map((m) => [undefined, undefined, undefined, m.net < 0 ? C.expense : undefined]) },
  );

  // ---------- Dívidas ----------
  heading('Evolução das dívidas', 'Saldo no fim de cada mês: cartões (com parcelas futuras) e empréstimos (saldo devedor).');
  table(
    [{ label: 'Mês', width: 120 }, { label: 'Cartões', width: 125, align: 'right' }, { label: 'Empréstimos', width: 125, align: 'right' }, { label: 'Total', width: WIDTH - 370, align: 'right' }],
    report.debts.map((d) => [`${monthName(d.month)} de ${d.month.slice(0, 4)}`, formatBRL(d.cards), formatBRL(d.loans), formatBRL(d.total)]),
  );

  // ---------- Maiores despesas ----------
  heading('Maiores despesas');
  if (report.topExpenses.length === 0) empty('Nenhuma despesa paga no período.');
  else {
    table(
      [{ label: 'Data', width: 62 }, { label: 'Descrição', width: 170 }, { label: 'Categoria', width: 105 }, { label: 'Conta', width: 87 }, { label: 'Valor', width: WIDTH - 424, align: 'right' }],
      report.topExpenses.map((e) => [brDate(e.date), e.description, e.category, e.account, formatBRL(e.amount)]),
    );
  }

  // ---------- Saldos ----------
  heading(`Saldo das contas em ${brDate(report.balances.date)}`, 'Contas ativas, sem cartões. Útil para a ficha "Bens e Direitos" do IR.');
  if (report.balances.items.length === 0) empty('Nenhuma conta ativa.');
  else {
    table(
      [{ label: 'Conta', width: WIDTH - 140 }, { label: 'Saldo', width: 140, align: 'right' }],
      [...report.balances.items.map((b) => [b.name, formatBRL(b.balance)]), ['Total', formatBRL(report.balances.total)]],
      { boldLast: true },
    );
  }

  // ---------- Notas ----------
  heading('Notas');
  const notes = [
    'Regime de caixa: só entra o que foi pago, pela data de pagamento. Transferências entre contas ficam de fora.',
    'Compras no cartão contam na data de cada parcela. Na dívida do cartão, a compra parcelada conta inteira desde a 1ª parcela.',
    'A dívida de empréstimo é o saldo devedor pela tabela Price, o mesmo valor da "quitação estimada" no app.',
    'A comparação usa o período anterior de mesmo tamanho. "novo" indica que não havia valor antes.',
  ];
  for (const n of notes) {
    ensure(14);
    text(`• ${n}`, MARGIN, y - 10, { size: 8, color: C.muted, width: WIDTH });
    y -= 14;
  }

  // Rodapé com a numeração, depois que todas as páginas existem.
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = `Página ${i + 1} de ${pages.length}`;
    p.drawText(label, { x: PAGE[0] - MARGIN - regular.widthOfTextAtSize(label, 8), y: 28, size: 8, font: regular, color: C.muted });
    p.drawText('FinControl · relatório gerado a partir dos seus lançamentos', { x: MARGIN, y: 28, size: 8, font: regular, color: C.muted });
  });

  return doc.save();
}
