import { describe, expect, it } from 'vitest';
import { plainText } from './assistant.service';

describe('plainText (A12)', () => {
  it('tira o markdown que o modelo usou em produção', () => {
    const reply = 'Gabriel, aqui está:\n\n**Últimos 6 meses (maio a outubro):**\nSem lançamentos.\n\n## Metas\n* Viagem: *no ritmo*\n• Reserva\n\n\n\nUse `Relatórios`.';
    expect(plainText(reply)).toBe('Gabriel, aqui está:\n\nÚltimos 6 meses (maio a outubro):\nSem lançamentos.\n\nMetas\n- Viagem: no ritmo\n- Reserva\n\nUse Relatórios.');
  });

  it('negrito que quebra linha sai; asteriscos de parágrafos diferentes não se juntam', () => {
    expect(plainText('**Despesas:\nR$ 500**')).toBe('Despesas:\nR$ 500');
    expect(plainText('a ** b\n\nc ** d')).toBe('a ** b\n\nc ** d');
    expect(plainText('**Cálculo:\nR$ 20 * 3 = R$ 60**')).toBe('Cálculo:\nR$ 20 * 3 = R$ 60');
  });

  it('conta com asteriscos continua conta; marcador sozinho na linha não engole a próxima', () => {
    expect(plainText('R$ 20 * 3 * 2 = R$ 120')).toBe('R$ 20 * 3 * 2 = R$ 120');
    expect(plainText('R$ 20 *3* 2 = R$ 120')).toBe('R$ 20 *3* 2 = R$ 120');
    expect(plainText('Meta *no ritmo*.')).toBe('Meta no ritmo.');
    expect(plainText('Resumo\n*\nTotal: R$ 500')).toBe('Resumo\n*\nTotal: R$ 500');
    expect(plainText('  * Total: R$ 500')).toBe('- Total: R$ 500');
  });

  it('não mexe em texto puro, valores e listas com hífen', () => {
    const reply = 'Você gastou R$ 1.234,56 (12% a mais).\n- Mercado: R$ 500,00\n- 2 * 3 = 6';
    expect(plainText(reply)).toBe(reply);
  });
});
