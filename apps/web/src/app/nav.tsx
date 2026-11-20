import {
  ArrowLeftRight, CalendarDays, FileChartColumn, Gem, HandCoins, Landmark, LayoutDashboard, Newspaper, Sparkles, Tags, Target, UserRound, Wallet, type LucideIcon,
} from 'lucide-react';
import { PALETTE } from '../lib/palette';

/**
 * `tone`: a cor do quadrado do item na folha "Mais" do celular. `bar`: o item fica na barra do celular (sub-projeto 16,
 * L6: Painel, Lançamentos e Contas, com o "+" e o "Mais"); o resto aparece na folha "Mais". Substitui a P9 e a R12.
 */
export type NavItem = { to: string; label: string; icon: LucideIcon; tone: string; bar?: true };

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Painel', icon: LayoutDashboard, tone: PALETTE.lime, bar: true },
  { to: '/lancamentos', label: 'Lançamentos', icon: ArrowLeftRight, tone: PALETTE.sky, bar: true },
  { to: '/contas', label: 'Contas', icon: Wallet, tone: PALETTE.grape, bar: true },
  { to: '/planejamento', label: 'Planejamento', icon: Target, tone: PALETTE.tangerine },
  { to: '/calendario', label: 'Calendário', icon: CalendarDays, tone: PALETTE.sky },
  { to: '/emprestimos', label: 'Empréstimos', icon: Landmark, tone: PALETTE.indigo },
  { to: '/dividas', label: 'Dívidas', icon: HandCoins, tone: PALETTE.pink },
  { to: '/patrimonio', label: 'Patrimônio', icon: Gem, tone: PALETTE.grape },
  { to: '/resumo', label: 'Resumo do mês', icon: Newspaper, tone: PALETTE.banana },
  { to: '/relatorios', label: 'Relatórios', icon: FileChartColumn, tone: PALETTE.teal },
  { to: '/assistente', label: 'Assistente', icon: Sparkles, tone: PALETTE.lime },
  { to: '/categorias', label: 'Categorias', icon: Tags, tone: PALETTE.tangerine },
  { to: '/perfil', label: 'Perfil', icon: UserRound, tone: PALETTE.slate },
];

export const BAR_ITEMS = NAV_ITEMS.filter((item) => item.bar);
export const MORE_ITEMS = NAV_ITEMS.filter((item) => !item.bar);

/** "Mais" fica marcado quando a tela aberta (ou o detalhe dela, como /dividas/:id) está na folha. */
export const isInMore = (pathname: string) => MORE_ITEMS.some(({ to }) => pathname === to || pathname.startsWith(`${to}/`));
