import type { AssetKind } from '@fincontrol/shared';
import { Car, HandCoins, House, Package, TrendingUp, type LucideIcon } from 'lucide-react';
import { PALETTE } from '../../lib/palette';

/** Ícone e cor do tipo do bem (B4; cores de apoio do sub-projeto 16, L3). */
export const ASSET_KIND_ICON: Record<AssetKind, { icon: LucideIcon; color: string }> = {
  property: { icon: House, color: PALETTE.tangerine },
  vehicle: { icon: Car, color: PALETTE.sky },
  investment: { icon: TrendingUp, color: PALETTE.grape },
  receivable: { icon: HandCoins, color: PALETTE.teal },
  other: { icon: Package, color: PALETTE.slate },
};
