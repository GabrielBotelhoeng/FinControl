import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import { inkOn } from '../../lib/palette';

const TILE = { sm: 'h-8 w-8 rounded-[10px]', md: 'h-10 w-10 rounded-[13px]', lg: 'h-12 w-12 rounded-[15px]' } as const;
const ICON = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' } as const;

/**
 * Ícone de traço num quadrado arredondado preenchido com a cor da categoria, da conta ou de apoio (sub-projeto 16, L5).
 * O traço fica branco ou escuro, o que contrastar mais. Só decoração: o texto ao lado diz o que é.
 */
export function IconTile({ icon: Icon, color, size = 'md', className }: { icon: LucideIcon; color: string; size?: keyof typeof TILE; className?: string }) {
  return (
    <span aria-hidden className={cn('grid shrink-0 place-items-center', TILE[size], className)} style={{ backgroundColor: color, color: inkOn(color) }}>
      <Icon className={ICON[size]} strokeWidth={2} />
    </span>
  );
}
