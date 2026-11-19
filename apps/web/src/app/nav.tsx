import {
  ArrowLeftRight, CalendarDays, FileChartColumn, Gem, HandCoins, Landmark, LayoutDashboard, Newspaper, Sparkles, Tags, Target, UserRound, Wallet, type LucideIcon,
} from 'lucide-react';

/** `mobile: false` tira o item da barra do celular (P9 e R12: mais de 6 itens não cabem a 360 px). */
export type NavItem = { to: string; label: string; icon: LucideIcon; mobile?: false };

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Painel', icon: LayoutDashboard },
  { to: '/lancamentos', label: 'Lançamentos', icon: ArrowLeftRight },
  { to: '/contas', label: 'Contas', icon: Wallet },
  { to: '/planejamento', label: 'Planejamento', icon: Target },
  { to: '/calendario', label: 'Calendário', icon: CalendarDays, mobile: false },
  { to: '/emprestimos', label: 'Empréstimos', icon: Landmark },
  { to: '/dividas', label: 'Dívidas', icon: HandCoins, mobile: false },
  { to: '/patrimonio', label: 'Patrimônio', icon: Gem, mobile: false },
  { to: '/resumo', label: 'Resumo do mês', icon: Newspaper, mobile: false },
  { to: '/relatorios', label: 'Relatórios', icon: FileChartColumn, mobile: false },
  { to: '/assistente', label: 'Assistente', icon: Sparkles, mobile: false },
  { to: '/categorias', label: 'Categorias', icon: Tags, mobile: false },
  { to: '/perfil', label: 'Perfil', icon: UserRound },
];
