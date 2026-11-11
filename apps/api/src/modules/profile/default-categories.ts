import type { CategoryType } from '@fincontrol/shared';

export const DEFAULT_CATEGORIES: ReadonlyArray<{ name: string; type: CategoryType; icon: string; color: string }> = [
  { name: 'Moradia', type: 'expense', icon: 'house', color: '#6366f1' },
  { name: 'Alimentação', type: 'expense', icon: 'utensils', color: '#f97316' },
  { name: 'Transporte', type: 'expense', icon: 'car', color: '#0ea5e9' },
  { name: 'Saúde', type: 'expense', icon: 'heart-pulse', color: '#ef4444' },
  { name: 'Educação', type: 'expense', icon: 'graduation-cap', color: '#8b5cf6' },
  { name: 'Lazer', type: 'expense', icon: 'party-popper', color: '#ec4899' },
  { name: 'Assinaturas', type: 'expense', icon: 'repeat', color: '#14b8a6' },
  { name: 'Compras', type: 'expense', icon: 'shopping-bag', color: '#eab308' },
  { name: 'Contas', type: 'expense', icon: 'receipt', color: '#64748b' },
  { name: 'Outros', type: 'expense', icon: 'circle-ellipsis', color: '#94a3b8' },
  { name: 'Salário', type: 'income', icon: 'briefcase', color: '#16a34a' },
  { name: 'Freelance', type: 'income', icon: 'laptop', color: '#22c55e' },
  { name: 'Rendimentos', type: 'income', icon: 'trending-up', color: '#10b981' },
  { name: 'Outros', type: 'income', icon: 'circle-plus', color: '#84cc16' },
];
