/** Limite de qualquer valor monetário: R$ 1 bilhão, em centavos. */
export const MAX_CENTS = 100_000_000_000;

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

const WITH_THOUSANDS = /^-?\d{1,3}(\.\d{3})+(,\d{1,2})?$/;
const PLAIN = /^-?\d+(,\d{1,2})?$/;

/** Converte texto digitado em pt-BR ("1.234,56", "R$ 12,3") para centavos. */
export function parseBRLToCents(input: string): number | null {
  const cleaned = input.replace(/R\$/g, '').replace(/\s/g, '');
  if (!WITH_THOUSANDS.test(cleaned) && !PLAIN.test(cleaned)) return null;

  const negative = cleaned.startsWith('-');
  const [intPart = '0', decPart = ''] = cleaned.replace('-', '').replace(/\./g, '').split(',');
  const cents = Number(intPart) * 100 + Number(decPart.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}
