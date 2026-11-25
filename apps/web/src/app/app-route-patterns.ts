/**
 * As rotas do app como expressões, a partir dos rewrites do `vercel.json` (`/cartoes/:id` → `^/cartoes/[^/]+$`): a mesma
 * fonte serve a Vercel, o `vite preview` (previewLikeVercel) e o service worker, que só abre a casca do app nessas rotas
 * (`navigateFallbackAllowlist`). As páginas públicas e os caminhos desconhecidos ficam de fora (sub-projeto 18, E5).
 */
export function appRoutePatterns(rewrites: { source: string }[]): RegExp[] {
  return rewrites.map((r) => new RegExp(`^${r.source.replace(/:\w+/g, '[^/]+')}$`));
}

/**
 * As mesmas rotas para o service worker, que compara o caminho com a query (`/lancamentos?novo=1`, o atalho do app
 * instalado): aceitam uma query no fim, e as páginas públicas e os caminhos desconhecidos continuam de fora.
 */
export function offlineAppPatterns(rewrites: { source: string }[]): RegExp[] {
  // `^/lancamentos$` → `^/lancamentos(\?.*)?$`
  return appRoutePatterns(rewrites).map((pattern) => new RegExp(`${pattern.source.slice(0, -1)}(\\?.*)?$`));
}
