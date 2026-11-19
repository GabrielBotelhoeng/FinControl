/**
 * Leitura de extrato bancário (sub-projeto 9, I1–I3): OFX (padrão dos bancos brasileiros) e CSV (Nubank, Inter,
 * planilhas). Função pura: o navegador lê o arquivo e a API só recebe as linhas. Valores em centavos, com sinal
 * (negativo = saída).
 */
import { isValidDateOnly, type DateOnly } from './dates';

export type StatementRow = { date: DateOnly; description: string; amount: number };
export type StatementResult = { format: 'ofx' | 'csv'; rows: StatementRow[]; skipped: number };

export class StatementError extends Error {}

export const MAX_STATEMENT_ROWS = 1000;

/** "R$ -1.234,56", "-1234.56", "1,5" e "(12,00)" → centavos; texto que não é número → null. */
export function parseMoney(text: string): number | null {
  let t = text.trim().replace(/R\$|\s| /g, '');
  let negative = false;
  if (/^\(.*\)$/.test(t)) {
    negative = true;
    t = t.slice(1, -1);
  }
  if (t.startsWith('-')) {
    negative = !negative;
    t = t.slice(1);
  } else if (t.startsWith('+')) t = t.slice(1);
  if (!/^[\d.,]+$/.test(t) || !/\d/.test(t)) return null;
  const lastComma = t.lastIndexOf(',');
  const lastDot = t.lastIndexOf('.');
  // O separador decimal é o último que aparece e tem no máximo 2 dígitos depois; o outro é de milhar.
  const decimalSep = lastComma > lastDot ? ',' : '.';
  const decimalIdx = Math.max(lastComma, lastDot);
  const hasDecimal = decimalIdx >= 0 && t.length - decimalIdx - 1 <= 2 && !(decimalSep === '.' && lastComma >= 0 && lastComma > lastDot);
  const intPart = (hasDecimal ? t.slice(0, decimalIdx) : t).replace(/[.,]/g, '');
  const decPart = hasDecimal ? t.slice(decimalIdx + 1).padEnd(2, '0') : '00';
  const cents = Number(intPart || '0') * 100 + Number(decPart);
  if (!Number.isFinite(cents)) return null;
  return negative ? -cents : cents;
}

/** "31/12/2026", "2026-12-31", "20261231" e "31/12/26" → AAAA-MM-DD; inválida → null. */
export function parseStatementDate(text: string): DateOnly | null {
  const t = text.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t) ?? /^(\d{4})(\d{2})(\d{2})/.exec(t);
  if (m) {
    const d = `${m[1]}-${m[2]}-${m[3]}`;
    return isValidDateOnly(d) ? d : null;
  }
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(t);
  if (m) {
    const year = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
    const d = `${year}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
    return isValidDateOnly(d) ? d : null;
  }
  return null;
}

const cleanText = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim().slice(0, 120);

/** I1: OFX 1.x (SGML, sem fechamento de tag) ou 2.x (XML). Cada `<STMTTRN>` vira uma linha. */
function parseOfx(text: string): StatementResult {
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const tag = (block: string, name: string) => new RegExp(`<${name}>([^<\\r\\n]*)`, 'i').exec(block)?.[1]?.trim() ?? '';
  const rows: StatementRow[] = [];
  let skipped = 0;
  for (const raw of blocks) {
    const block = raw.split(/<\/STMTTRN>/i)[0]!;
    const date = parseStatementDate(tag(block, 'DTPOSTED'));
    const amount = parseMoney(tag(block, 'TRNAMT'));
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

/** Divide uma linha de CSV respeitando aspas ("a;b" é um campo só). */
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]!;
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (c === sep && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((f) => f.trim());
}

const DATE_HEADERS = ['data', 'date', 'data lancamento', 'data do lancamento', 'data de lancamento', 'dt'];
const DESC_HEADERS = ['descricao', 'description', 'historico', 'title', 'titulo', 'lancamento', 'estabelecimento', 'memo', 'detalhes'];
const AMOUNT_HEADERS = ['valor', 'amount', 'quantia', 'valor (r$)', 'valor r$'];

/** I2: CSV com cabeçalho. Acha as colunas de data, descrição e valor pelo nome; separador `;` ou `,`. */
function parseCsv(text: string): StatementResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) throw new StatementError('O arquivo está vazio.');
  const first = lines[0]!;
  const sep = (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) ? ';' : ',';
  const header = splitCsvLine(first, sep).map(fold);
  const find = (names: string[]) => header.findIndex((h) => names.includes(h));
  const iDate = find(DATE_HEADERS);
  const iAmount = find(AMOUNT_HEADERS);
  let iDesc = find(DESC_HEADERS);
  // Inter tem "Histórico" e "Descrição": junta os dois mais adiante; aqui fica a primeira que existir.
  const iDesc2 = header.findIndex((h, i) => i !== iDesc && DESC_HEADERS.includes(h));
  if (iDate < 0 || iAmount < 0) {
    throw new StatementError('Não achei as colunas de data e valor no CSV. O cabeçalho precisa ter "Data" e "Valor".');
  }
  if (iDesc < 0) iDesc = -1;
  const rows: StatementRow[] = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const f = splitCsvLine(line, sep);
    const date = parseStatementDate(f[iDate] ?? '');
    const amount = parseMoney(f[iAmount] ?? '');
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
  const isOfx = /OFXHEADER|<OFX>/i.test(text.slice(0, 2000));
  const result = isOfx ? parseOfx(text) : parseCsv(text);
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
