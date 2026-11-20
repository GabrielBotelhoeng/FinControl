import type { AccountType } from '@fincontrol/shared';
import { CreditCard, Landmark, PiggyBank, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';

/** Ícone de cada tipo de conta; a carteira é a padrão. */
export const ACCOUNT_ICONS: Record<AccountType, LucideIcon> = {
  checking: Landmark,
  savings: PiggyBank,
  wallet: Wallet,
  investment: TrendingUp,
  credit_card: CreditCard,
};

export const accountIcon = (type: string): LucideIcon => ACCOUNT_ICONS[type as AccountType] ?? Wallet;
