import { cn } from '../../lib/cn';

/**
 * O símbolo (o mesmo de public/icon.svg; sub-projeto 16, L9): o "F" de barras inclinadas e a seta de crescimento com as
 * barrinhas em limão, num quadrado escuro. As cores são fixas para o símbolo ser igual em qualquer tema.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 512 512" className={cn('shrink-0', className)}>
      <rect width="512" height="512" rx="112" fill="#14170F" />
      <path
        fill="#F4F6EE"
        d="M128 384 L128 206 Q128 140 194 140 L412 140 L370 204 L226 204 Q200 204 200 230 L200 244 L322 244 L286 300 L200 300 L200 384 Q200 402 182 402 L146 402 Q128 402 128 384 Z"
      />
      <g fill="#C8F24B">
        <rect x="250" y="362" width="28" height="40" rx="7" />
        <rect x="294" y="342" width="28" height="60" rx="7" />
        <rect x="338" y="304" width="28" height="98" rx="7" />
      </g>
      <path d="M214 352 Q316 334 372 262" fill="none" stroke="#C8F24B" strokeWidth="20" strokeLinecap="round" />
      <path fill="#C8F24B" d="M402 224 L395 281 L348 245 Z" />
    </svg>
  );
}

/** Símbolo e nome: "Fin" na cor do texto e "Control" no verde da marca. `tagline` mostra "Planeje · Controle · Realize". */
export function Logo({ className, markClassName = 'h-8 w-8', tagline = false }: { className?: string; markClassName?: string; tagline?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={markClassName} />
      <span className="grid">
        <span className="font-display text-xl font-bold leading-none tracking-tight">
          Fin<span className="text-primary">Control</span>
        </span>
        {tagline && (
          <span className="mt-1.5 text-[10px] font-semibold uppercase leading-none tracking-[0.22em] text-muted">
            Planeje <span className="text-primary">·</span> Controle <span className="text-primary">·</span> Realize
          </span>
        )}
      </span>
    </span>
  );
}
