import { ArrowLeftRight, Landmark, LayoutDashboard, Tags, UserRound, Wallet, type LucideIcon } from 'lucide-react';

export type NavItem = { to: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Painel', icon: LayoutDashboard },
  { to: '/lancamentos', label: 'Lançamentos', icon: ArrowLeftRight },
  { to: '/contas', label: 'Contas', icon: Wallet },
  { to: '/emprestimos', label: 'Empréstimos', icon: Landmark },
  { to: '/categorias', label: 'Categorias', icon: Tags },
  { to: '/perfil', label: 'Perfil', icon: UserRound },
];
