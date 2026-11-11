import type { CategorySpendDTO } from '@fincontrol/shared';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { formatBRL } from '../../lib/format';
import { iconFor } from '../categories/icons';

const MAX_SLICES = 6;
const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

/** Agrupa a cauda em "Outras" para nunca passar de 6 fatias. */
function fold(data: CategorySpendDTO[]): CategorySpendDTO[] {
  if (data.length <= MAX_SLICES) return data;
  const head = data.slice(0, MAX_SLICES - 1);
  const tail = data.slice(MAX_SLICES - 1).reduce((s, c) => s + c.total, 0);
  return [...head, { categoryId: 'outras', name: 'Outras', icon: 'circle-ellipsis', color: '#64748B', total: tail }];
}

export function CategoryDonut({ data }: { data: CategorySpendDTO[] }) {
  const slices = fold(data);
  const total = slices.reduce((s, c) => s + c.total, 0);
  return (
    <div className="grid items-center gap-6 sm:grid-cols-[180px_1fr]">
      <div className="relative mx-auto h-44 w-44" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="total" nameKey="name" innerRadius="68%" outerRadius="100%" paddingAngle={2} stroke="var(--surface)" strokeWidth={2} isAnimationActive={false}>
              {slices.map((s) => (
                <Cell key={s.categoryId} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[11px] text-muted">Total</p>
            <p className="tabular font-display text-sm font-bold">{formatBRL(total)}</p>
          </div>
        </div>
      </div>
      <ul className="grid gap-2.5">
        {slices.map((s) => {
          const Icon = iconFor(s.icon);
          return (
            <li key={s.categoryId} className="flex items-center gap-3 text-sm">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ backgroundColor: `${s.color}22`, color: s.color }}>
                <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              </span>
              <span className="flex-1 truncate">{s.name}</span>
              <span className="tabular text-xs text-muted">{percent.format(total ? s.total / total : 0)}</span>
              <span className="tabular w-28 text-right font-semibold">{formatBRL(s.total)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
