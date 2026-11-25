import { Logo } from '../components/ui/logo';

/**
 * A página do `dist/404.html` (sub-projeto 18, E5): HTML puro, gerado no build, sem o JavaScript do app. Um link comum
 * (não o do React Router), porque nada aqui é hidratado.
 */
export function NotFoundPage() {
  return (
    <div className="aurora grid min-h-dvh place-items-center px-4">
      <main className="flex max-w-md flex-col items-center gap-6 text-center">
        <Logo />
        <h1 className="font-display text-[clamp(2rem,6vw,2.75rem)] font-extrabold leading-tight tracking-[-0.02em]">Página não encontrada</h1>
        <p className="text-[0.95rem] leading-relaxed text-muted">O endereço pode ter mudado ou estar escrito errado. Comece pelo início do FinControl.</p>
        <a
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-brand-fg transition-transform duration-200 active:scale-[0.98]"
        >
          Ir para o início
        </a>
      </main>
    </div>
  );
}
