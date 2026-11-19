/**
 * Leitura de extrato bancário (sub-projeto 9, I1–I3): OFX (padrão dos bancos brasileiros) e CSV (Nubank, Inter,
 * planilhas). Função pura: o navegador lê o arquivo e a API só recebe as linhas. Valores em centavos, com sinal
 * (negativo = saída).
 */
import { isValidDateOnly, type DateOnly } from './dates';
import { MAX_CENTS } from './money';

export type StatementRow = { date: DateOnly; description: string; amount: number };
export type StatementResult = { format: 'ofx' | 'csv'; rows: StatementRow[]; skipped: number };

export class StatementError extends Error {}

export const MAX_STATEMENT_ROWS = 1000;

const CARD_STATEMENT_MESSAGE =
  'Este arquivo é a fatura de um cartão. A importação é para extrato de conta (corrente, poupança, carteira): as compras no cartão entram pelo lançamento no cartão.';

/**
 * "R$ -1.234,56", "-1234.56", "1,5", "(12,00)", "10,00-", "10,00 D", "10,00 C" e "\u221210,00" (menos Unicode) → centavos;
 * texto que não é número → null. "D" no fim é saída e "C" é entrada.
 */
export function parseMoney(text: string): number | null {
  let t = text.trim().replace(/R\$|\s/g, '').replace(/\u2212/g, '-');
  let negative = false;
  const suffix = /([DC])$/i.exec(t);
  if (suffix) {
    negative = suffix[1]!.toUpperCase() === 'D';
    t = t.slice(0, -1);
  }
  if (/^\(.*\)$/.test(t)) {
    negative = !negative;
    t = t.slice(1, -1);
  }
  if (t.startsWith('-')) {
    negative = !negative;
    t = t.slice(1);
  } else if (t.endsWith('-')) {
    negative = !negative;
    t = t.slice(0, -1);
  } else if (t.startsWith('+')) t = t.slice(1);
  if (!/^[\d.,]+$/.test(t) || !/\d/.test(t)) return null;
  const lastComma = t.lastIndexOf(',');
  const lastDot = t.lastIndexOf('.');
  // O separador decimal é o último que aparece, com no máximo 2 dígitos depois; o outro é de milhar ("1.000" = mil).
  const decimalIdx = Math.max(lastComma, lastDot);
  const hasDecimal = decimalIdx >= 0 && t.length - decimalIdx - 1 <= 2;
  const intPart = (hasDecimal ? t.slice(0, decimalIdx) : t).replace(/[.,]/g, '');
  const decPart = hasDecimal ? t.slice(decimalIdx + 1).padEnd(2, '0') : '00';
  const cents = Number(intPart || '0') * 100 + Number(decPart);
  if (!Number.isFinite(cents) || cents > MAX_CENTS) return null;
  return negative ? -cents : cents;
}

/** No OFX o ponto (ou a vírgula, em alguns bancos) é sempre decimal: "-12.345" é R$ 12,35, não doze mil. */
function parseOfxAmount(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^[-+]?\d+(\.\d+)?$/.test(t)) return null;
  const cents = Math.round(Number(t) * 100);
  return Math.abs(cents) > MAX_CENTS ? null : cents;
}

/** "31/12/2026", "31/12/2026 10:30", "2026-12-31", "20261231" e "31/12/26" → AAAA-MM-DD; inválida → null. */
export function parseStatementDate(text: string): DateOnly | null {
  const t = text.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t) ?? /^(\d{4})(\d{2})(\d{2})/.exec(t);
  if (m) {
    const d = `${m[1]}-${m[2]}-${m[3]}`;
    return isValidDateOnly(d) ? d : null;
  }
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/.exec(t);
  if (m) {
    // Ano com 2 dígitos: até 50 é 20xx, depois 19xx ("01/01/99" é 1999, não 2099).
    const year = m[3]!.length === 2 ? `${Number(m[3]) <= 50 ? '20' : '19'}${m[3]}` : m[3]!;
    const d = `${year}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
    return isValidDateOnly(d) ? d : null;
  }
  return null;
}

const cleanText = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim().slice(0, 120);

/** I1: OFX 1.x (SGML, sem fechamento de tag) ou 2.x (XML). Cada `<STMTTRN>` vira uma linha. */
function parseOfx(text: string): StatementResult {
  if (/<CCSTMTRS>/i.test(text)) throw new StatementError(CARD_STATEMENT_MESSAGE);
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const tag = (block: string, name: string) => new RegExp(`<${name}>([^<\\r\\n]*)`, 'i').exec(block)?.[1]?.trim() ?? '';
  const rows: StatementRow[] = [];
  let skipped = 0;
  for (const raw of blocks) {
    const block = raw.split(/<\/STMTTRN>/i)[0]!;
    const date = parseStatementDate(tag(block, 'DTPOSTED'));
    const amount = parseOfxAmount(tag(block, 'TRNAMT'));
    const description = cleanText(tag(block, 'MEMO') || tag(block, 'NAME') || tag(block, 'PAYEE'));
    if (!date || amount === null || amount === 0) {
      skipped += 1;
      continue;
    }
    rows.push({ date, description: description || 'Sem descrição', amount });
  }
  return { format: 'ofx', rows, skipped };
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** Divide o texto em registros e campos respeitando aspas: `;`, `,` e quebras de linha entre aspas são do campo. */
function csvRecords(text: string, sep: string): string[][] {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]!;
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (!quoted && c === sep) {
      record.push(field.trim());
      field = '';
    } else if (!quoted && (c === '\n' || c === '\r')) {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      record.push(field.trim());
      if (record.some((f) => f !== '')) records.push(record);
      record = [];
      field = '';
    } else field += c;
  }
  record.push(field.trim());
  if (record.some((f) => f !== '')) records.push(record);
  return records;
}

/** Conta o separador fora das aspas (um campo como "a,b,c" não decide o separador). */
function countOutsideQuotes(line: string, sep: string): number {
  let quoted = false;
  let n = 0;
  for (const c of line) {
    if (c === '"') quoted = !quoted;
    else if (c === sep && !quoted) n += 1;
  }
  return n;
}

const DATE_HEADERS = ['data', 'date', 'data lancamento', 'data do lancamento', 'data de lancamento', 'data movimento', 'dt'];
const DESC_HEADERS = ['descricao', 'description', 'historico', 'title', 'titulo', 'lancamento', 'estabelecimento', 'memo', 'detalhes'];
const AMOUNT_HEADERS = ['valor', 'amount', 'quantia', 'valor (r$)', 'valor r$'];
const CREDIT_HEADERS = ['credito', 'credito (r$)', 'entrada', 'entradas'];
const DEBIT_HEADERS = ['debito', 'debito (r$)', 'saida', 'saidas'];
const SIGN_HEADERS = ['tipo', 'd/c', 'dc', 'natureza', 'tipo de lancamento'];

/** I2: CSV com cabeçalho (procurado nas 20 primeiras linhas, porque alguns bancos põem o nome da conta antes). */
function parseCsv(text: string): StatementResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) throw new StatementError('O arquivo está vazio.');
  const sepOf = (line: string) => (countOutsideQuotes(line, ';') >= countOutsideQuotes(line, ',') ? ';' : ',');

  let headerIdx = -1;
  let header: string[] = [];
  for (let i = 0; i < Math.min(lines.length, 20); i += 1) {
    const cells = csvRecords(lines[i]!, sepOf(lines[i]!))[0]?.map(fold) ?? [];
    const hasDate = cells.some((c) => DATE_HEADERS.includes(c));
    const hasValue = cells.some((c) => AMOUNT_HEADERS.includes(c) || CREDIT_HEADERS.includes(c) || DEBIT_HEADERS.includes(c));
    if (hasDate && hasValue) {
      headerIdx = i;
      header = cells;
      break;
    }
  }
  if (headerIdx < 0) {
    throw new StatementError('Não achei as colunas de data e valor no CSV. O cabeçalho precisa ter "Data" e "Valor".');
  }
  // Fatura do cartão do Nubank: "date,title,amount", com o gasto positivo. Numa conta, inverteria todos os sinais.
  if (header.join('|') === 'date|title|amount') throw new StatementError(CARD_STATEMENT_MESSAGE);

  const sep = sepOf(lines[headerIdx]!);
  const find = (names: string[]) => header.findIndex((h) => names.includes(h));
  const iDate = find(DATE_HEADERS);
  const iAmount = find(AMOUNT_HEADERS);
  const iCredit = find(CREDIT_HEADERS);
  const iDebit = find(DEBIT_HEADERS);
  const iSign = find(SIGN_HEADERS);
  const iDesc = find(DESC_HEADERS);
  // Inter tem "Histórico" e "Descrição": as duas entram, juntas.
  const iDesc2 = header.findIndex((h, i) => i !== iDesc && DESC_HEADERS.includes(h));

  const body = text.split(/\r?\n/);
  // As linhas antes do cabeçalho (nome da conta, período) ficam de fora; o resto é lido com aspas e quebras.
  const startLine = body.findIndex((l) => l.trim() !== '' && l === lines[headerIdx]);
  const records = csvRecords(body.slice(startLine + 1).join('\n'), sep);

  const rows: StatementRow[] = [];
  let skipped = 0;
  for (const f of records) {
    const date = parseStatementDate(f[iDate] ?? '');
    let amount: number | null = null;
    if (iAmount >= 0) {
      amount = parseMoney(f[iAmount] ?? '');
      // Coluna de tipo ao lado de um valor sempre positivo: D/Débito/Saída é saída.
      const sign = iSign >= 0 ? fold(f[iSign] ?? '') : '';
      if (amount !== null && amount > 0 && /^(d|deb|debito|saida|s)\b/.test(sign)) amount = -amount;
    } else {
      const credit = iCredit >= 0 ? parseMoney(f[iCredit] ?? '') : null;
      const debit = iDebit >= 0 ? parseMoney(f[iDebit] ?? '') : null;
      if (credit) amount = Math.abs(credit);
      else if (debit) amount = -Math.abs(debit);
    }
    if (!date || amount === null || amount === 0) {
      skipped += 1;
      continue;
    }
    const parts = [iDesc >= 0 ? f[iDesc] : '', iDesc2 >= 0 ? f[iDesc2] : ''].filter((p): p is string => Boolean(p));
    rows.push({ date, description: cleanText(parts.join(' - ')) || 'Sem descrição', amount });
  }
  return { format: 'csv', rows, skipped };
}

/** I3: escolhe o formato pelo conteúdo (OFX tem `<OFX>` ou `OFXHEADER`) e limita a 1.000 linhas. */
export function parseStatement(text: string): StatementResult {
  const clean = text.replace(/^\uFEFF/, '');
  const isOfx = /OFXHEADER|<OFX>/i.test(clean.slice(0, 2000));
  // Fim de linha só com CR (exportações antigas) vira LF: a leitura das linhas e dos registros concorda.
  const normalized = clean.replace(/\r\n?/g, '\n');
  const result = isOfx ? parseOfx(normalized) : parseCsv(normalized);
  if (result.rows.length === 0) throw new StatementError('Nenhum lançamento encontrado no arquivo.');
  if (result.rows.length > MAX_STATEMENT_ROWS) {
    throw new StatementError(`O arquivo tem ${result.rows.length} lançamentos. Importe no máximo ${MAX_STATEMENT_ROWS} de cada vez.`);
  }
  return result;
}

/** Descrição comparável: sem acentos, maiúsculas, números e pontuação ("PIX 1234 Padaria São João" → "pix padaria sao joao"). */
export function normalizeDescription(s: string): string {
  return fold(s).replace(/[\d*#/\\.,;:_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Para palavras-chave: sem acentos e pontuação, mas com os números ("99APP" continua "99app"). */
export function keywordText(s: string): string {
  // "99,90" continua um número só ("9990"): não pode casar com a palavra-chave "99 " (CodeRabbit).
  return fold(s).replace(/(\d)[.,](?=\d)/g, '$1').replace(/[*#/\\.,;:_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}
