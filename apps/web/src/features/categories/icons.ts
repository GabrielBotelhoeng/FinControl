import {
  Baby, Briefcase, Car, CircleEllipsis, CirclePlus, Dog, Dumbbell, Fuel, Gift, GraduationCap, HeartPulse, House, Laptop,
  PartyPopper, PiggyBank, Plane, Receipt, Repeat, ShoppingBag, Smartphone, Tag, TrendingUp, Utensils, type LucideIcon,
} from 'lucide-react';

/** Nomes de ícone guardados na API (kebab-case do Lucide) → componente. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  house: House, utensils: Utensils, car: Car, 'heart-pulse': HeartPulse, 'graduation-cap': GraduationCap,
  'party-popper': PartyPopper, repeat: Repeat, 'shopping-bag': ShoppingBag, receipt: Receipt, 'circle-ellipsis': CircleEllipsis,
  briefcase: Briefcase, laptop: Laptop, 'trending-up': TrendingUp, 'circle-plus': CirclePlus, dog: Dog, plane: Plane,
  gift: Gift, baby: Baby, dumbbell: Dumbbell, fuel: Fuel, smartphone: Smartphone, 'piggy-bank': PiggyBank,
};

export const iconFor = (name: string): LucideIcon => CATEGORY_ICONS[name] ?? Tag;
