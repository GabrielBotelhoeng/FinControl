import type { AssetKind } from '@fincontrol/shared';
import { Car, HandCoins, House, Package, TrendingUp, type LucideIcon } from 'lucide-react';

/** Ícone do tipo do bem (B4). */
export const ASSET_KIND_ICON: Record<AssetKind, LucideIcon> = {
  property: House,
  vehicle: Car,
  investment: TrendingUp,
  receivable: HandCoins,
  other: Package,
};
