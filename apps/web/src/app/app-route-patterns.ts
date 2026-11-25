/**
 * As rotas do app como expressões, a partir dos rewrites do `vercel.json` (`/cartoes/:id` → `^/cartoes/[^/]+$`): a mesma
 * fonte serve a Vercel, o `vite preview` (previewLikeVercel) e o service worker, que só abre a casca do app nessas rotas
 * (`navigateFallbackAllowlist`). As páginas públicas e os caminhos desconhecidos ficam de fora (sub-projeto 18, E5).
 */
export function appRoutePatterns(rewrites: { source: string }[]): RegExp[] {
  return rewrites.map((r) => new RegExp(`^${r.source.replace(/:\w+/g, '[^/]+')}$`));
}
