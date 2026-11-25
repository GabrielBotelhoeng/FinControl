import { useState, useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * `false` no build (prerender) e durante a hidratação do HTML estático; `true` depois dela e em toda tela desenhada do
 * zero (`createRoot`). O que depende do navegador (largura, `prefers-reduced-motion`) só entra quando é `true`, para o
 * cliente hidratar exatamente o mesmo HTML que o build gerou (sub-projeto 18, E3 e E4).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/** O componente nasceu do HTML estático (no build ou na hidratação)? Fica fixo pela vida do componente. */
export function useBornFromStaticHtml(): boolean {
  const hydrated = useHydrated();
  const [bornStatic] = useState(!hydrated);
  return bornStatic;
}
