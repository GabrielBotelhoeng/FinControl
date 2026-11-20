import { accountTypeSchema, assetKindSchema } from '@fincontrol/shared';
import { render } from '@testing-library/react';
import { Tag, Wallet } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_ICONS } from '../../features/accounts/icons';
import { iconFor } from '../../features/categories/icons';
import { ASSET_KIND_ICON } from '../../features/net-worth/asset-kind';
import { inkOn, PALETTE } from '../../lib/palette';
import { IconTile } from './icon-tile';

// Os ícones das categorias padrão da API (default-categories.ts) e o da categoria das dívidas (debts.service.ts).
const API_ICONS = [
  'house', 'utensils', 'car', 'heart-pulse', 'graduation-cap', 'party-popper', 'repeat', 'shopping-bag', 'receipt', 'landmark',
  'circle-ellipsis', 'briefcase', 'laptop', 'trending-up', 'circle-plus', 'handshake',
];

describe('quadrados coloridos dos ícones (sub-projeto 16, L5)', () => {
  it('o traço fica branco nas cores escuras e escuro nas claras', () => {
    expect(inkOn('#6366F1')).toBe('#FFFFFF');
    expect(inkOn('#64748b')).toBe('#FFFFFF');
    expect(inkOn(PALETTE.lime)).toBe('#14170F');
    expect(inkOn(PALETTE.banana)).toBe('#14170F');
    expect(inkOn('#eab308')).toBe('#14170F');
    expect(inkOn('cor-invalida')).toBe('#FFFFFF');
  });

  it('as categorias padrão, todos os tipos de conta e de bem têm ícone próprio', () => {
    expect(API_ICONS.filter((icon) => iconFor(icon) === Tag)).toEqual([]);
    expect(accountTypeSchema.options.filter((t) => !ACCOUNT_ICONS[t])).toEqual([]);
    expect(assetKindSchema.options.filter((k) => !ASSET_KIND_ICON[k])).toEqual([]);
    expect(iconFor('icone-que-nao-existe')).toBe(Tag);
  });

  it('pinta o quadrado com a cor e fica fora do leitor de tela', () => {
    const { container } = render(<IconTile icon={Wallet} color="#6366F1" />);
    const tile = container.firstElementChild as HTMLElement;
    expect(tile).toHaveAttribute('aria-hidden', 'true');
    expect(tile.style.backgroundColor).toBe('rgb(99, 102, 241)');
    expect(tile.style.color).toBe('rgb(255, 255, 255)');
  });
});
