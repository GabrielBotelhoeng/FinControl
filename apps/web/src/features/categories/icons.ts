import {
  Baby, Briefcase, Car, CircleEllipsis, CirclePlus, Dog, Dumbbell, Fuel, Gift, GraduationCap, Handshake, HeartPulse, House, Landmark, Laptop,
  PartyPopper, PiggyBank, Plane, Receipt, Repeat, ShoppingBag, ShoppingCart, Smartphone, Tag, TrendingUp, Utensils, type LucideIcon,
} from 'lucide-react';

/**
 * Nomes de ícone guardados na API (kebab-case do Lucide) → componente. A ordem é a do seletor da categoria.
 * "shopping-cart" e "handshake" entraram no sub-projeto 16 ("handshake" já era o ícone da categoria das dívidas).
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  house: House, utensils: Utensils, 'shopping-cart': ShoppingCart, car: Car, fuel: Fuel, 'heart-pulse': HeartPulse, 'graduation-cap': GraduationCap,
  'party-popper': PartyPopper, repeat: Repeat, 'shopping-bag': ShoppingBag, receipt: Receipt, smartphone: Smartphone, dog: Dog, baby: Baby,
  dumbbell: Dumbbell, plane: Plane, gift: Gift, landmark: Landmark, handshake: Handshake, 'circle-ellipsis': CircleEllipsis, briefcase: Briefcase,
  laptop: Laptop, 'trending-up': TrendingUp, 'piggy-bank': PiggyBank, 'circle-plus': CirclePlus,
};

export const iconFor = (name: string): LucideIcon => CATEGORY_ICONS[name] ?? Tag;
