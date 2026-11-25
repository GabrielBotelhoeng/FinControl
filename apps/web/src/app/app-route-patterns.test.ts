import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appRoutePatterns } from './app-route-patterns';

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

  it('o service worker só abre a casca do app nessas rotas (navigateFallbackAllowlist), e o preview usa as mesmas', () => {
    const config = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');
    expect(config).toMatch(/navigateFallbackAllowlist:\s*appRoutePatterns\(/);
    expect(config).not.toMatch(/navigateFallbackDenylist/);
    expect(config).toMatch(/appRoutePatterns\(rewrites\)/);
  });
});
