import type { ReportDebtPointDTO, ReportMonthDTO } from '@fincontrol/shared';
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatBRL, formatMonthShort } from '../../lib/format';

// Abaixo de R$ 1 mil, em reais; acima, "1,5 mil" (arredondar sempre para mil repetia "0 mil" e "1 mil" no eixo).
const compact = (cents: number) =>
  Math.abs(cents) < 100000 ? `R$ ${Math.round(cents / 100)}` : `${(cents / 100000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
const axisTick = { fill: 'var(--text-muted)', fontSize: 12 };

function Legend({ items }: { items: { label: string; swatch: string }[] }) {
  return (
    <div className="mb-4 flex flex-wrap gap-4 text-xs text-muted" aria-hidden>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-2">
          <span className={i.swatch} /> {i.label}
        </span>
      ))}
    </div>
  );
}

function Tip({ active, payload, rows }: { active?: boolean; payload?: Array<{ payload: Record<string, number | string> }>; rows: [string, string][] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-[var(--radius-control)] border border-border bg-surface px-3.5 py-2.5 text-xs shadow-panel">
      <p className="mb-1.5 font-semibold">{formatMonthShort(String(p.month))}</p>
      {rows.map(([key, label]) => (
        <p key={key} className="tabular">{`${label}: ${formatBRL(Number(p[key]))}`}</p>
      ))}
    </div>
  );
}

const HATCH = '[background-image:repeating-linear-gradient(45deg,transparent_0_2px,rgba(0,0,0,.35)_2px_3px)]';

/** Receitas e despesas (despesa com hachura, para não depender só da cor) e o saldo de cada mês em linha. */
export function MonthlyChart({ data }: { data: ReportMonthDTO[] }) {
  return (
    <figure>
      <Legend
        items={[
          { label: 'Receitas', swatch: 'h-2.5 w-2.5 rounded-sm bg-income' },
          { label: 'Despesas', swatch: `h-2.5 w-2.5 rounded-sm bg-expense ${HATCH}` },
          { label: 'Saldo do mês', swatch: 'h-0.5 w-3 rounded bg-primary' },
        ]}
      />
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={2}>
            <defs>
              <pattern id="report-hatch-expense" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="var(--expense)" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
              </pattern>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="month" tickFormatter={formatMonthShort} tickLine={false} axisLine={false} tick={axisTick} minTickGap={8} />
            <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={48} tick={axisTick} />
            <Tooltip content={<Tip rows={[['income', 'Receitas'], ['expense', 'Despesas'], ['net', 'Saldo do mês']]} />} cursor={{ fill: 'var(--surface-2)' }} />
            <Bar dataKey="income" fill="var(--income)" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="expense" fill="url(#report-hatch-expense)" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Line dataKey="net" type="monotone" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3, fill: 'var(--primary)', strokeWidth: 0 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {data.map((m) => `${formatMonthShort(m.month)}: receitas ${formatBRL(m.income)}, despesas ${formatBRL(m.expense)}, saldo ${formatBRL(m.net)}`).join('; ')}
      </figcaption>
    </figure>
  );
}

/** Dívida no fim de cada mês, empilhada: empréstimos (dourado) e cartões (cinza com hachura). */
export function DebtChart({ data }: { data: ReportDebtPointDTO[] }) {
  return (
    <figure>
      <Legend
        items={[
          { label: 'Empréstimos', swatch: 'h-2.5 w-2.5 rounded-sm bg-primary' },
          { label: 'Cartões', swatch: `h-2.5 w-2.5 rounded-sm bg-muted ${HATCH}` },
        ]}
      />
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <pattern id="report-hatch-cards" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="var(--text-muted)" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
              </pattern>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="month" tickFormatter={formatMonthShort} tickLine={false} axisLine={false} tick={axisTick} minTickGap={8} />
            <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={48} tick={axisTick} />
            <Tooltip content={<Tip rows={[['loans', 'Empréstimos'], ['cards', 'Cartões'], ['total', 'Total']]} />} cursor={{ fill: 'var(--surface-2)' }} />
            <Bar dataKey="loans" stackId="debt" fill="var(--primary)" maxBarSize={28} />
            <Bar dataKey="cards" stackId="debt" fill="url(#report-hatch-cards)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {data.map((d) => `${formatMonthShort(d.month)}: empréstimos ${formatBRL(d.loans)}, cartões ${formatBRL(d.cards)}, total ${formatBRL(d.total)}`).join('; ')}
      </figcaption>
    </figure>
  );
}
