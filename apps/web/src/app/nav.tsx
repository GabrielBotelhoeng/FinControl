import { ArrowLeftRight, FileChartColumn, Landmark, LayoutDashboard, Tags, Target, UserRound, Wallet, type LucideIcon } from 'lucide-react';

/** `mobile: false` tira o item da barra do celular (P9 e R12: mais de 6 itens não cabem a 360 px). */
export type NavItem = { to: string; label: string; icon: LucideIcon; mobile?: false };

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Painel', icon: LayoutDashboard },
  { to: '/lancamentos', label: 'Lançamentos', icon: ArrowLeftRight },
  { to: '/contas', label: 'Contas', icon: Wallet },
  { to: '/planejamento', label: 'Planejamento', icon: Target },
  { to: '/emprestimos', label: 'Empréstimos', icon: Landmark },
  { to: '/relatorios', label: 'Relatórios', icon: FileChartColumn, mobile: false },
  { to: '/categorias', label: 'Categorias', icon: Tags, mobile: false },
  { to: '/perfil', label: 'Perfil', icon: UserRound },
];
