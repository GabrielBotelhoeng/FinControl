import { useSyncExternalStore } from 'react';

const DESKTOP = '(min-width: 768px)';

/**
 * Computador ou celular (o `md` do Tailwind). No build e na hidratação, `false` (a versão do celular: o HTML gerado é um
 * só); no computador, troca logo depois.
 */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(DESKTOP);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );
}
