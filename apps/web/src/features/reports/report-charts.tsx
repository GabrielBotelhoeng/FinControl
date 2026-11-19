import type { ReportDebtPointDTO, ReportMonthDTO } from '@fincontrol/shared';
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisTick, ChartLegend as Legend, ChartTip as Tip, compact, HATCH } from '../../components/ui/chart';
import { formatBRL, formatMonthShort } from '../../lib/format';

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
          { label: 'Credores', swatch: 'h-2.5 w-2.5 rounded-sm bg-expense' },
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
            <Tooltip content={<Tip rows={[['loans', 'Empréstimos'], ['others', 'Credores'], ['cards', 'Cartões'], ['total', 'Total']]} />} cursor={{ fill: 'var(--surface-2)' }} />
            <Bar dataKey="loans" stackId="debt" fill="var(--primary)" maxBarSize={28} />
            <Bar dataKey="others" stackId="debt" fill="var(--expense)" maxBarSize={28} />
            <Bar dataKey="cards" stackId="debt" fill="url(#report-hatch-cards)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {data.map((d) => `${formatMonthShort(d.month)}: empréstimos ${formatBRL(d.loans)}, credores ${formatBRL(d.others)}, cartões ${formatBRL(d.cards)}, total ${formatBRL(d.total)}`).join('; ')}
      </figcaption>
    </figure>
  );
}
