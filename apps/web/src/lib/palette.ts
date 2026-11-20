/** Cores de apoio (DESIGN.md, sub-projeto 16, L3), as mesmas de styles/index.css: só decoração. */
export const PALETTE = {
  lime: '#C8F24B',
  tangerine: '#FF8A3D',
  grape: '#7C5CFF',
  sky: '#38BDF8',
  banana: '#FFD43B',
  pink: '#F472B6',
  teal: '#2DD4BF',
  indigo: '#6366F1',
  slate: '#64748B',
} as const;

const INK = '#14170F';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** A cor do ícone sobre um fundo `hex`: branco ou tinta escura, o que contrastar mais. Cor inválida fica com branco. */
export function inkOn(hex: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#FFFFFF';
  const l = luminance(hex);
  return 1.05 / (l + 0.05) >= (l + 0.05) / (luminance(INK) + 0.05) ? '#FFFFFF' : INK;
}
