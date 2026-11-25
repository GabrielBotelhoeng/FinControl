import { createElement, lazy, type ComponentType } from 'react';

export type Preloadable<P extends object> = ComponentType<P> & { preload: () => Promise<unknown> };

/**
 * Um `lazy` que pode ser carregado antes de ser desenhado. Depois do `preload()`, desenha o componente na hora, sem
 * suspender: na hidratação do HTML estático (sub-projeto 18), uma parte que suspende fica "desidratada", e a primeira
 * atualização de estado (a conferência da sessão) faz o React jogar fora o HTML do servidor e desenhar do zero.
 */
export function preloadable<P extends object>(factory: () => Promise<{ default: ComponentType<P> }>): Preloadable<P> {
  let loaded: ComponentType<P> | undefined;
  let loading: Promise<{ default: ComponentType<P> }> | undefined;
  const load = () =>
    (loading ??= factory().then(
      (module) => {
        loaded = module.default;
        return module;
      },
      (error: unknown) => {
        // Falhou (rede): a próxima carga tenta de novo, em vez de reaproveitar a promessa rejeitada.
        loading = undefined;
        throw error;
      },
    ));
  const Lazy = lazy(load);
  function Preloaded(props: P) {
    return loaded ? createElement(loaded, props) : createElement(Lazy, props);
  }
  return Object.assign(Preloaded, { preload: load });
}

/**
 * Tenta `load` e, se falhar, de novo depois de cada espera de `delays` (em ms); rejeita com o último erro. Usado para
 * carregar o pedaço da página pública antes de hidratar o HTML estático (boot.tsx).
 */
export async function retrying<T>(load: () => Promise<T>, delays: number[]): Promise<T> {
  for (const delay of delays) {
    try {
      return await load();
    } catch {
      await new Promise((done) => setTimeout(done, delay));
    }
  }
  return load();
}
