import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appRoutePatterns, offlineAppPatterns } from './app-route-patterns';

// O Vitest roda a partir de apps/web.
const vercel = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as { rewrites: { source: string; destination: string }[] };
const patterns = appRoutePatterns(vercel.rewrites);
const isApp = (path: string) => patterns.some((p) => p.test(path));

describe('rotas do app para o PWA e o preview, a partir do vercel.json (sub-projeto 18, CodeRabbit)', () => {
  it('uma expressão por rewrite do vercel.json (a mesma fonte do teste rotas × vercel.json)', () => {
    expect(patterns).toHaveLength(vercel.rewrites.length);
  });

  it('casam as rotas do app, com os parâmetros', () => {
    for (const path of ['/entrar', '/lancamentos', '/cartoes/abc-123', '/dividas/plano', '/dividas/xyz', '/emprestimos/1', '/perfil']) expect(isApp(path), path).toBe(true);
  });

  it('deixam de fora as páginas públicas, os caminhos desconhecidos e os de mais de um nível (o 404 de verdade)', () => {
    for (const path of ['/', '/privacidade', '/termos', '/nao-existe', '/lancamentos/x', '/cartoes', '/cartoes/a/b', '/api/v1/health', '/entrarx']) {
      expect(isApp(path), path).toBe(false);
    }
  });

  it('o preview usa as mesmas rotas, e o service worker não tem mais a lista de exclusão', () => {
    const config = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');
    expect(config).not.toMatch(/navigateFallbackDenylist/);
    expect(config).toMatch(/appRoutePatterns\(rewrites\)/);
  });

  it('no service worker (que compara caminho + query), os atalhos do manifest abrem a casca offline, e as públicas e desconhecidas ficam fora', () => {
    const config = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');
    const shortcuts = [...config.matchAll(/\bshort_name: '[^']+', url: '([^']+)'/g)].map((m) => m[1]!);
    expect(shortcuts).toEqual(['/lancamentos?novo=1', '/calendario', '/importar']);
    const offline = offlineAppPatterns(vercel.rewrites);
    const opens = (url: string) => offline.some((p) => p.test(url));
    for (const url of [...shortcuts, '/entrar?modo=cadastro', '/cartoes/abc?mes=2026-11', '/cartoes/abc?x=1', '/lancamentos?novo=1']) expect(opens(url), url).toBe(true);
    for (const url of ['/', '/?code=x', '/privacidade', '/termos?x=1', '/nao-existe', '/nao-existe?x=1', '/lancamentosx', '/lancamentos/x?y=1']) expect(opens(url), url).toBe(false);
    // O parâmetro não engole a query: sem o ID, não é rota do app, e o service worker deixa chegar ao 404 (CodeRabbit).
    for (const url of ['/cartoes/?x=1', '/emprestimos/?x=1', '/dividas/?x=1']) expect(opens(url), url).toBe(false);
    expect(config).toMatch(/navigateFallbackAllowlist:\s*offlineAppPatterns\(rewrites\)/);
  });
});
