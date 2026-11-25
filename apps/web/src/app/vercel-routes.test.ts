import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RouteObject } from 'react-router';
import { describe, expect, it } from 'vitest';
import { PUBLIC_HEAD } from '../lib/public-head';
import { routes } from './routes';

// O Vitest roda a partir de apps/web.
type Rule = { source: string; destination?: string };
const vercel = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as { rewrites: Rule[]; headers: Rule[] };

/** Os caminhos de todas as rotas, como a Vercel escreve (`/cartoes/:id`), sem o índice e sem o `*`. */
function routePaths(list: RouteObject[], base = ''): string[] {
  return list.flatMap((route) => {
    if (route.index || route.path === '*') return [];
    const path = route.path ? `${base}/${route.path.replace(/^\//, '')}`.replace(/\/+/g, '/') : base;
    return [path || '/', ...routePaths(route.children ?? [], path === '/' ? '' : path)];
  });
}

const publicPaths = Object.keys(PUBLIC_HEAD);
const appPaths = routePaths(routes).filter((path) => !publicPaths.includes(path));

describe('vercel.json × rotas do app (sub-projeto 18, E5)', () => {
  it('toda rota do app abre a casca do app (uma rota nova esquecida aqui viraria 404)', () => {
    expect(appPaths.length).toBeGreaterThan(15);
    expect(vercel.rewrites.map((r) => r.source).sort()).toEqual([...appPaths].sort());
    for (const rule of vercel.rewrites) expect(rule.destination, rule.source).toBe('/app.html');
  });

  it('as páginas públicas saem do HTML gerado no build, sem rewrite, e não há mais o "tudo para o index.html"', () => {
    const sources = vercel.rewrites.map((r) => r.source);
    for (const path of publicPaths) expect(sources).not.toContain(path);
    expect(sources).not.toContain('/(.*)');
    expect(vercel.rewrites.some((r) => r.destination === '/index.html')).toBe(false);
  });

  it('os cabeçalhos de segurança continuam valendo para tudo (inclusive o 404.html)', () => {
    expect(vercel.headers.map((h) => h.source)).toEqual(['/(.*)']);
  });
});
