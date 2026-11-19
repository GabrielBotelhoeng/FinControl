import { describe, expect, it } from 'vitest';
import { keywordText, normalizeDescription, parseMoney, parseStatement, parseStatementDate, StatementError } from './statement';

const BOM = String.fromCharCode(0xfeff);
const MINUS = String.fromCharCode(0x2212);

describe('parseMoney', () => {
  it.each([
    ['1.234,56', 123456], ['-1.234,56', -123456], ['R$ 12,30', 1230], ['-12.30', -1230], ['1234.5', 123450],
    ['1,234.56', 123456], ['(45,00)', -4500], ['+10', 1000], ['0,99', 99], ['1.000', 100000], ['abc', null], ['', null],
    ['10,00-', -1000], ['10,00 D', -1000], ['10,00 C', 1000], [`${MINUS}10,00`, -1000], ['R$ -10,00', -1000],
  ])('%s → %s', (text, cents) => expect(parseMoney(text)).toBe(cents));
});

describe('parseStatementDate', () => {
  it.each([
    ['31/12/2026', '2026-12-31'], ['2026-12-31', '2026-12-31'], ['20261231120000[-3:BRT]', '2026-12-31'],
    ['1/2/26', '2026-02-01'], ['31/02/2026', null], ['ontem', null], ['01/11/2026 10:30', '2026-11-01'], ['01/01/99', '1999-01-01'],
  ])('%s → %s', (text, date) => expect(parseStatementDate(text)).toBe(date));
});

const lines = (...l: string[]) => l.join(String.fromCharCode(10));

describe('parseStatement', () => {
  it('OFX 1.x (SGML) com MEMO, NAME e acentos codificados', () => {
    const ofx = lines(
      'OFXHEADER:100',
      'DATA:OFXSGML',
      '<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>',
      '<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261105120000[-3:BRT]<TRNAMT>-45.90<FITID>1<MEMO>PADARIA S&amp;J',
      '<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261110<TRNAMT>3000.00<FITID>2<NAME>SALARIO EMPRESA</STMTTRN>',
      '<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>xx<TRNAMT>-1<FITID>3<MEMO>quebrada',
      '</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>',
    );
    expect(parseStatement(ofx)).toEqual({
      format: 'ofx',
      skipped: 1,
      rows: [
        { date: '2026-11-05', description: 'PADARIA S&J', amount: -4590 },
        { date: '2026-11-10', description: 'SALARIO EMPRESA', amount: 300000 },
      ],
    });
  });

  it('OFX: o ponto é sempre decimal ("-12.346" não é doze mil) e extrato de cartão (<CCSTMTRS>) é recusado', () => {
    const ofx = (body: string) => lines('OFXHEADER:100', `<OFX>${body}<STMTTRN><DTPOSTED>20261105<TRNAMT>-12.346<MEMO>X</OFX>`);
    expect(parseStatement(ofx('')).rows[0]!.amount).toBe(-1235);
    expect(() => parseStatement(ofx('<CCSTMTRS>'))).toThrow(/fatura de um cartão/);
  });

  it('CSV do Nubank conta (vírgula, valor com ponto)', () => {
    const csv = lines('Data,Valor,Identificador,Descrição', '05/11/2026,-45.90,abc,"Compra no débito - Padaria, Centro"', '10/11/2026,3000.00,def,Transferência recebida');
    expect(parseStatement(csv).rows).toEqual([
      { date: '2026-11-05', description: 'Compra no débito - Padaria, Centro', amount: -4590 },
      { date: '2026-11-10', description: 'Transferência recebida', amount: 300000 },
    ]);
  });

  it('CSV do Inter (ponto e vírgula, histórico e descrição juntos, saldo ignorado)', () => {
    const csv = lines('Data Lançamento;Histórico;Descrição;Valor;Saldo', '05/11/2026;Pix enviado;Fulano;-1.200,00;800,00');
    expect(parseStatement(csv).rows).toEqual([{ date: '2026-11-05', description: 'Pix enviado - Fulano', amount: -120000 }]);
  });

  it('fatura do cartão do Nubank (date,title,amount) é recusada: numa conta, inverteria os sinais', () => {
    expect(() => parseStatement(lines('date,title,amount', '2026-11-01,Uber,25.90'))).toThrow(/fatura de um cartão/);
  });

  it('cabeçalho depois de linhas de informação, BOM, aspas com quebra de linha e vírgula dentro do campo', () => {
    const csv = BOM + lines('Extrato Conta Corrente', 'Conta ;1234', '', 'Data;Descrição;Valor;"Extra,um,dois,tres"', '05/11/2026;"Loja', 'Centro";-10,00;x');
    expect(parseStatement(csv).rows).toEqual([{ date: '2026-11-05', description: 'Loja Centro', amount: -1000 }]);
  });

  it('coluna de tipo (D/C) e colunas de crédito e débito separadas', () => {
    expect(parseStatement(lines('Data;Descrição;Valor;Tipo', '05/11/2026;Mercado;50,00;D', '06/11/2026;Pix;20,00;C')).rows.map((r) => r.amount)).toEqual([-5000, 2000]);
    expect(parseStatement(lines('Data;Histórico;Crédito;Débito', '05/11/2026;Mercado;;50,00', '06/11/2026;Pix;20,00;')).rows.map((r) => r.amount)).toEqual([-5000, 2000]);
  });

  it('CSV sem data ou valor no cabeçalho, arquivo vazio e sem lançamentos dão erro explicado', () => {
    expect(() => parseStatement(lines('Nome;Quantia', 'x;1'))).toThrow(StatementError);
    expect(() => parseStatement('')).toThrow('O arquivo está vazio.');
    expect(() => parseStatement(lines('Data;Valor', ''))).toThrow('Nenhum lançamento encontrado no arquivo.');
  });

  it('mais de 1.000 linhas: pede para dividir', () => {
    const csv = lines('Data;Valor;Descrição', ...Array.from({ length: 1001 }, () => '01/11/2026;-1,00;x'));
    expect(() => parseStatement(csv)).toThrow(/no máximo 1000/);
  });
});

describe('normalizeDescription e keywordText', () => {
  it('tira acentos, números e pontuação; o texto das palavras-chave mantém os números', () => {
    expect(normalizeDescription('PIX 1234 - Padaria São João*')).toBe('pix padaria sao joao');
    expect(keywordText('99APP *Corrida')).toBe('99app corrida');
  });
});
