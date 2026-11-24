import { cn } from '../../lib/cn';
import type { Capture } from './captures';

/** A captura dentro da moldura, ou um placeholder com a mesma proporção enquanto ela não existe. */
function Screen({ capture, priority, className }: { capture: Capture; priority?: boolean; className?: string }) {
  if (!capture.src) {
    return (
      <div
        role="img"
        aria-label={capture.alt}
        className={cn('w-full bg-[linear-gradient(160deg,var(--surface-2),var(--primary-soft))]', className)}
        style={{ aspectRatio: `${capture.width} / ${capture.height}` }}
      />
    );
  }
  return (
    <img
      src={capture.src}
      alt={capture.alt}
      width={capture.width}
      height={capture.height}
      decoding="async"
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      className={cn('block h-auto w-full', className)}
    />
  );
}

/** Celular em CSS: corpo quase-preto, tela arredondada e a ilha da câmera. Nada de 3D (DESIGN.md). */
export function PhoneFrame({ capture, priority, className }: { capture: Capture; priority?: boolean; className?: string }) {
  return (
    <div className={cn('relative rounded-[44px] bg-[#14170F] p-[9px] shadow-[0_30px_60px_-24px_rgba(20,23,15,0.45)]', className)}>
      <div className="relative overflow-hidden rounded-[36px] bg-surface">
        <Screen capture={capture} priority={priority} />
        <span aria-hidden className="absolute left-1/2 top-2.5 h-[22px] w-[30%] -translate-x-1/2 rounded-full bg-[#14170F]" />
      </div>
    </div>
  );
}

/** Notebook em CSS: tela com borda fina e a base mais larga embaixo. */
export function LaptopFrame({ capture, className }: { capture: Capture; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <div className="rounded-t-[18px] bg-[#14170F] p-[10px] pb-[14px] shadow-[0_30px_60px_-28px_rgba(20,23,15,0.45)]">
        <div className="overflow-hidden rounded-[8px] bg-surface">
          <Screen capture={capture} />
        </div>
      </div>
      <div aria-hidden className="relative -mx-[6%] h-3.5 rounded-b-[14px] bg-[linear-gradient(#d9dccf,#b9bdae)]">
        <span className="absolute left-1/2 top-0 h-1.5 w-[14%] -translate-x-1/2 rounded-b-md bg-[#a7ab9c]" />
      </div>
    </div>
  );
}
