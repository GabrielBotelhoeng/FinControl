import type { NetWorthPointDTO } from '@fincontrol/shared';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisTick, ChartLegend, ChartTip, compact, HATCH } from '../../components/ui/chart';
import { formatBRL, formatMonthShort } from '../../lib/format';

/** B11: o que tem (contas + bens) e o que deve (com hachura) em barras, e o patrimônio líquido em linha. */
export function NetWorthChart({ data }: { data: NetWorthPointDTO[] }) {
  const rows = data.map((p) => ({ month: p.month, have: p.accounts + p.assets, owe: p.debts, total: p.total }));
  return (
    <figure>
      <ChartLegend
        items={[
          { label: 'O que você tem', swatch: 'h-2.5 w-2.5 rounded-sm bg-income' },
          { label: 'O que você deve', swatch: `h-2.5 w-2.5 rounded-sm bg-expense ${HATCH}` },
          { label: 'Patrimônio líquido', swatch: 'h-0.5 w-3 rounded bg-primary' },
        ]}
      />
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={2}>
            <defs>
              <pattern id="net-worth-hatch-owe" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="var(--expense)" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
              </pattern>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="month" tickFormatter={formatMonthShort} tickLine={false} axisLine={false} tick={axisTick} minTickGap={8} />
            <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={48} tick={axisTick} />
            <Tooltip
              content={<ChartTip rows={[['have', 'O que você tem'], ['owe', 'O que você deve'], ['total', 'Patrimônio líquido']]} />}
              cursor={{ fill: 'var(--surface-2)' }}
            />
            <Bar dataKey="have" fill="var(--income)" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="owe" fill="url(#net-worth-hatch-owe)" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Line dataKey="total" type="monotone" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3, fill: 'var(--primary)', strokeWidth: 0 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {rows
          .map((r) => `${formatMonthShort(r.month)}: o que você tem ${formatBRL(r.have)}, o que você deve ${formatBRL(r.owe)}, patrimônio líquido ${formatBRL(r.total)}`)
          .join('; ')}
      </figcaption>
    </figure>
  );
}
