import type { ReactNode } from 'react';

/** Título da tela com contraste de peso (fino + extra-negrito) e ações à direita. */
export function PageHeader({ light, bold, description, actions }: { light: string; bold: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[clamp(2rem,4vw,2.75rem)] leading-none tracking-[-0.03em]">
          <span className="font-extralight">{light}</span> <span className="font-extrabold">{bold}</span>
        </h1>
        {description && <p className="mt-3 max-w-[60ch] text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
