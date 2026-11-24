import { cn } from '../../lib/cn';
import type { Capture } from './captures';

/** A captura dentro da moldura, ou um placeholder com a mesma proporção enquanto ela não existe. */
function Screen({ capture, priority, sizes, className }: { capture: Capture; priority?: boolean; sizes?: string; className?: string }) {
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
      srcSet={capture.srcSet}
      sizes={capture.srcSet ? sizes : undefined}
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

const PHONE = {
  md: { body: 'rounded-[44px] p-[9px]', screen: 'rounded-[36px] pt-[9%]', island: 'top-[2.2%] h-[22px]', sizes: '320px' },
  // Celular miniatura (ao lado do notebook): borda e ilha da câmera proporcionais ao tamanho.
  sm: { body: 'rounded-[22px] p-[4px]', screen: 'rounded-[18px] pt-[9%]', island: 'top-[2.2%] h-[9px]', sizes: '160px' },
} as const;

/** Celular em CSS: corpo quase-preto, tela arredondada e a ilha da câmera. Nada de 3D (DESIGN.md). */
/** `sizes` é a largura da tela na página, para o navegador escolher entre a captura de 560 e a de 780 px. */
export function PhoneFrame({
  capture,
  priority,
  size = 'md',
  sizes,
  className,
}: {
  capture: Capture;
  priority?: boolean;
  size?: keyof typeof PHONE;
  sizes?: string;
  className?: string;
}) {
  const s = PHONE[size];
  return (
    <div className={cn('relative bg-[#14170F] shadow-[0_30px_60px_-24px_rgba(20,23,15,0.45)]', s.body, className)}>
      {/* A faixa de status em cima (cor do fundo do app) guarda a ilha da câmera sem cobrir a captura. */}
      <div className={cn('relative overflow-hidden bg-background', s.screen)}>
        <Screen capture={capture} priority={priority} sizes={sizes ?? s.sizes} />
        <span aria-hidden className={cn('absolute left-1/2 w-[30%] -translate-x-1/2 rounded-full bg-[#14170F]', s.island)} />
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
