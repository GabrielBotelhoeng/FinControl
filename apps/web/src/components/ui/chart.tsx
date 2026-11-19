import { formatBRL, formatMonthShort } from '../../lib/format';

// Partes comuns dos gráficos de barras por mês (relatórios e patrimônio).

/** Abaixo de R$ 1 mil, em reais; acima, "1,5 mil" (arredondar sempre para mil repetia "0 mil" e "1 mil" no eixo). */
export const compact = (cents: number) =>
  Math.abs(cents) < 100000 ? `R$ ${Math.round(cents / 100)}` : `${(cents / 100000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
export const axisTick = { fill: 'var(--text-muted)', fontSize: 12 };

/** Hachura das barras de saída e de dívida, para não depender só da cor. */
export const HATCH = '[background-image:repeating-linear-gradient(45deg,transparent_0_2px,rgba(0,0,0,.35)_2px_3px)]';

export function ChartLegend({ items }: { items: { label: string; swatch: string }[] }) {
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

export function ChartTip({ active, payload, rows }: { active?: boolean; payload?: Array<{ payload: Record<string, number | string> }>; rows: [string, string][] }) {
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
