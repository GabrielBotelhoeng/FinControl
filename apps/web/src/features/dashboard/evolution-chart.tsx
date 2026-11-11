import type { EvolutionPointDTO } from '@fincontrol/shared';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatBRL } from '../../lib/format';

const shortMonth = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });
const label = (ym: string) => shortMonth.format(new Date(`${ym}-01T00:00:00Z`)).replace('.', '');
const compact = (cents: number) => `${Math.round(cents / 100000)} mil`;

type TipProps = { active?: boolean; payload?: Array<{ payload: EvolutionPointDTO }> };

function Tip({ active, payload }: TipProps) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-[var(--radius-control)] border border-border bg-surface px-3.5 py-2.5 text-xs shadow-panel">
      <p className="mb-1.5 font-semibold capitalize">{label(p.month)}</p>
      <p className="tabular">Receitas: {formatBRL(p.income)}</p>
      <p className="tabular">Despesas: {formatBRL(p.expense)}</p>
      <p className="tabular text-muted">Saldo no fim do mês: {formatBRL(p.endBalance)}</p>
    </div>
  );
}

/** Barras de receita e despesa (despesa com hachura: não depender só de verde/vermelho) e linha de saldo, num único eixo. */
export function EvolutionChart({ data }: { data: EvolutionPointDTO[] }) {
  return (
    <figure>
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-muted" aria-hidden>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-income" /> Receitas
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-expense [background-image:repeating-linear-gradient(45deg,transparent_0_2px,rgba(0,0,0,.35)_2px_3px)]" /> Despesas
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-3 rounded bg-primary" /> Saldo no fim do mês
        </span>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={2}>
            <defs>
              <pattern id="hatch-expense" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="var(--expense)" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
              </pattern>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
            <XAxis dataKey="month" tickFormatter={label} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
            <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={48} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
            <Tooltip content={<Tip />} cursor={{ fill: 'var(--surface-2)' }} />
            <Bar dataKey="income" name="Receitas" fill="var(--income)" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="expense" name="Despesas" fill="url(#hatch-expense)" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Line dataKey="endBalance" name="Saldo" type="monotone" stroke="var(--primary)" strokeWidth={2} dot={{ r: 4, fill: 'var(--primary)', strokeWidth: 0 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {data.map((p) => `${label(p.month)}: receitas ${formatBRL(p.income)}, despesas ${formatBRL(p.expense)}, saldo ${formatBRL(p.endBalance)}`).join('; ')}
      </figcaption>
    </figure>
  );
}
