/** Tags dos lançamentos (spec do sub-projeto 13, T1 e T2). */

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;

/** T2: "  #Bebida   Alcoólica " → "bebida alcoólica" (sem o "#", espaços simples, minúsculas, acentos mantidos). */
export function normalizeTag(raw: string): string {
  return raw.normalize('NFC').trim().replace(/^#+/, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

/** Ordem das tags na tela e na API: alfabética em português. */
export const compareTags = (a: string, b: string) => a.localeCompare(b, 'pt-BR');
