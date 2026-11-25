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
 * instalado): aceitam uma query no fim, e as páginas públicas e os caminhos desconhecidos continuam de fora. O parâmetro
 * não aceita `?`: sem ele, `/cartoes/?x=1` (sem o ID) casaria com `/cartoes/:id` e não chegaria ao 404 (CodeRabbit).
 */
export function offlineAppPatterns(rewrites: { source: string }[]): RegExp[] {
  // `/lancamentos` → `^/lancamentos(\?.*)?$`; `/cartoes/:id` → `^/cartoes/[^/?]+(\?.*)?$`
  return rewrites.map((r) => new RegExp(`^${r.source.replace(/:\w+/g, '[^/?]+')}(\\?.*)?$`));
}
