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

/**
 * Notebook em CSS, com cara de MacBook (sub-projeto 20, V7): a tampa quase-preta com a câmera e uma sombra marcada; a
 * base em alumínio, mais larga, com a reentrância da abertura no meio da frente; e a sombra no chão. A borda da base
 * (`#7F8576`) fica acima de 3:1 contra o fundo claro da seção, para ela não sumir.
 */
export function LaptopFrame({ capture, className }: { capture: Capture; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <div className="relative rounded-t-[18px] border border-[#2A2F22] bg-[#14170F] p-[10px] pb-[14px] shadow-[0_36px_60px_-26px_rgba(20,23,15,0.6)]">
        <span aria-hidden className="absolute left-1/2 top-[3px] h-1 w-1 -translate-x-1/2 rounded-full bg-[#3A4030]" />
        <div className="overflow-hidden rounded-[8px] bg-surface">
          <Screen capture={capture} />
        </div>
      </div>
      <div aria-hidden className="relative -mx-[7%]">
        {/* Sombra no chão: gradiente radial, sem `filter: blur`. */}
        <span className="absolute inset-x-[3%] -bottom-5 h-8 bg-[radial-gradient(closest-side,rgb(20_23_15/0.32),transparent)]" />
        <div className="relative h-3.5 rounded-b-[18px] border border-t-0 border-[#7F8576] bg-[linear-gradient(#E1E4DA,#D9DCD3_30%,#B9BDB2_75%,#A3A89A)] shadow-[inset_0_1px_0_rgb(255_255_255/0.75)] md:h-5">
          <span className="absolute left-1/2 top-0 h-[45%] w-[15%] -translate-x-1/2 rounded-b-lg bg-[linear-gradient(#9EA396,#B9BDB2)]" />
        </div>
      </div>
    </div>
  );
}

/** iPad em CSS (sub-projeto 20, V8): cantos arredondados, borda escura fina e a câmera na borda de cima. */
export function TabletFrame({ capture, className }: { capture: Capture; className?: string }) {
  return (
    <div className={cn('relative rounded-[18px] bg-[#14170F] p-[6px] shadow-[0_30px_60px_-24px_rgba(20,23,15,0.5)] md:rounded-[22px] md:p-[8px]', className)}>
      <span aria-hidden className="absolute left-1/2 top-[2px] h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-[#3A4030] md:top-[3px]" />
      <div className="overflow-hidden rounded-[12px] bg-background md:rounded-[15px]">
        <Screen capture={capture} />
      </div>
    </div>
  );
}
