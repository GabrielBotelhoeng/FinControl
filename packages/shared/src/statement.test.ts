import { describe, expect, it } from 'vitest';
import { normalizeDescription, parseMoney, parseStatement, parseStatementDate, StatementError } from './statement';

describe('parseMoney', () => {
  it.each([
    ['1.234,56', 123456], ['-1.234,56', -123456], ['R$ 12,30', 1230], ['-12.30', -1230], ['1234.5', 123450],
    ['1,234.56', 123456], ['(45,00)', -4500], ['+10', 1000], ['0,99', 99], ['1.000', 100000], ['abc', null], ['', null],
  ])('%s → %s', (text, cents) => expect(parseMoney(text)).toBe(cents));
});

describe('parseStatementDate', () => {
  it.each([
    ['31/12/2026', '2026-12-31'], ['2026-12-31', '2026-12-31'], ['20261231120000[-3:BRT]', '2026-12-31'],
    ['1/2/26', '2026-02-01'], ['31/02/2026', null], ['ontem', null],
  ])('%s → %s', (text, date) => expect(parseStatementDate(text)).toBe(date));
});

describe('parseStatement', () => {
  it('OFX 1.x (SGML) com MEMO, NAME e acentos codificados', () => {
    const ofx = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261105120000[-3:BRT]<TRNAMT>-45.90<FITID>1<MEMO>PADARIA S&amp;J
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261110<TRNAMT>3000.00<FITID>2<NAME>SALARIO EMPRESA</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>xx<TRNAMT>-1<FITID>3<MEMO>quebrada
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    expect(parseStatement(ofx)).toEqual({
      format: 'ofx',
      skipped: 1,
      rows: [
        { date: '2026-11-05', description: 'PADARIA S&J', amount: -4590 },
        { date: '2026-11-10', description: 'SALARIO EMPRESA', amount: 300000 },
      ],
    });
  });

  it('CSV do Nubank conta (vírgula, valor com ponto)', () => {
    const csv = 'Data,Valor,Identificador,Descrição\n05/11/2026,-45.90,abc,"Compra no débito - Padaria, Centro"\n10/11/2026,3000.00,def,Transferência recebida';
    expect(parseStatement(csv).rows).toEqual([
      { date: '2026-11-05', description: 'Compra no débito - Padaria, Centro', amount: -4590 },
      { date: '2026-11-10', description: 'Transferência recebida', amount: 300000 },
    ]);
  });

  it('CSV do Inter (ponto e vírgula, histórico e descrição juntos, saldo ignorado)', () => {
    const csv = 'Data Lançamento;Histórico;Descrição;Valor;Saldo\n05/11/2026;Pix enviado;Fulano;-1.200,00;800,00';
    expect(parseStatement(csv).rows).toEqual([{ date: '2026-11-05', description: 'Pix enviado - Fulano', amount: -120000 }]);
  });

  it('CSV sem data ou valor no cabeçalho, arquivo vazio e sem lançamentos dão erro explicado', () => {
    expect(() => parseStatement('Nome;Quantia\nx;1')).toThrow(StatementError);
    expect(() => parseStatement('')).toThrow('O arquivo está vazio.');
    expect(() => parseStatement('Data;Valor\n')).toThrow('Nenhum lançamento encontrado no arquivo.');
  });

  it('mais de 1.000 linhas: pede para dividir', () => {
    const csv = ['Data;Valor;Descrição', ...Array.from({ length: 1001 }, () => '01/11/2026;-1,00;x')].join('\n');
    expect(() => parseStatement(csv)).toThrow(/no máximo 1000/);
  });
});

describe('normalizeDescription', () => {
  it('tira acentos, números e pontuação', () => {
    expect(normalizeDescription('PIX 1234 - Padaria São João*')).toBe('pix padaria sao joao');
  });
});
