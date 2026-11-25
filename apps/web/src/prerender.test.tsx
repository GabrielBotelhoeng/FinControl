// @vitest-environment node
// Ambiente node de propósito: é o caminho do build (sem window, document nem localStorage), como no scripts/prerender.mjs.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { PUBLIC_HEAD, SITE_URL } from './lib/public-head';
import { appShellHtml, notFoundHtml, pageHtml, PRERENDERED_PATHS, renderNotFoundBody, renderRoute } from './prerender';

// O Vitest roda a partir de apps/web.
const template = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const parse = (html: string) => new JSDOM(html).window.document;
const attr = (doc: Document, selector: string, name: string) => doc.querySelector(selector)?.getAttribute(name);

/** Nenhum script embutido executável: a CSP só aceita scripts do próprio site (o JSON-LD é só dados). */
function expectNoInlineScript(doc: Document) {
  for (const script of doc.querySelectorAll('script')) {
    if (script.getAttribute('type') === 'application/ld+json') continue;
    expect(script.getAttribute('src')).toBeTruthy();
  }
}

describe('HTML estático das páginas públicas (sub-projeto 18, E1 e E6)', () => {
  it('gera as três rotas públicas', () => {
    expect(PRERENDERED_PATHS).toEqual(['/', '/privacidade', '/termos']);
  });

  it.each([
    ['/', 'Seu dinheiro, sob controle.'],
    ['/privacidade', 'Política de Privacidade'],
    ['/termos', 'Termos de Uso'],
  ] as const)('%s: o h1, o texto e os links já vêm no HTML, com a cabeça própria', async (path, h1) => {
    const doc = parse(pageHtml(template, path, await renderRoute(path)));
    const root = doc.getElementById('root')!;
    expect(root.dataset.prerenderedRoute).toBe(path);
    // O preload que o React adianta não fica no #root (o cliente não o espera na hidratação).
    expect(root.querySelector('link')).toBeNull();
    expect(root.querySelector('h1')?.textContent).toBe(h1);
    expect(root.textContent!.length).toBeGreaterThan(1500);
    expect(root.querySelector('a[href="/termos"], a[href="/privacidade"]')).not.toBeNull();

    const head = PUBLIC_HEAD[path];
    const url = `${SITE_URL}${path}`;
    expect(doc.title).toBe(head.title);
    expect(attr(doc, 'meta[name="description"]', 'content')).toBe(head.description);
    expect(attr(doc, 'link[rel="canonical"]', 'href')).toBe(url);
    expect(attr(doc, 'meta[property="og:url"]', 'content')).toBe(url);
    expect(attr(doc, 'meta[property="og:title"]', 'content')).toBe(head.title);
    expect(attr(doc, 'meta[property="og:description"]', 'content')).toBe(head.description);
    expect(attr(doc, 'meta[name="twitter:title"]', 'content')).toBe(head.title);
    expect(attr(doc, 'meta[name="twitter:description"]', 'content')).toBe(head.description);
    // O theme-init.js lê esta meta (roda no <head>, antes de existir o #root) para decidir se o HTML estático vale.
    expect(attr(doc, 'meta[name="fincontrol-prerendered"]', 'content')).toBe(path);
    expect(doc.querySelector('meta[name="robots"]')).toBeNull();
    // O JSON-LD só na home (E6).
    expect(doc.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(path === '/' ? 1 : 0);
    expectNoInlineScript(doc);
  });

  it('cada página pública tem título e descrição próprios', () => {
    const heads = Object.values(PUBLIC_HEAD);
    expect(new Set(heads.map((h) => h.title)).size).toBe(heads.length);
    expect(new Set(heads.map((h) => h.description)).size).toBe(heads.length);
    for (const h of heads) expect(h.description.length).toBeGreaterThan(80);
  });

  it('na home, o site inteiro vem visível: nada começa com opacity 0 (E4)', async () => {
    const doc = parse(pageHtml(template, '/', await renderRoute('/')));
    const root = doc.getElementById('root')!;
    for (const id of ['como-funciona-titulo', 'recursos', 'celular-titulo', 'dados-titulo', 'planos', 'perguntas', 'chamada-final-titulo']) expect(root.querySelector(`#${id}`), id).not.toBeNull();
    expect(root.querySelector('footer')).not.toBeNull();
    expect(root.querySelectorAll('[style*="opacity:0"]')).toHaveLength(0);
    // O saldo do cartão limão já vem no valor final (não conta a partir de zero no que já está na tela).
    expect(root.textContent).toContain('21.359');
  });
});

describe('casca do app e página 404 (sub-projeto 18, E2 e E7)', () => {
  it('app.html: casca vazia, com noindex, sem canonical, sem as metas de compartilhamento da home nem JSON-LD', () => {
    const doc = parse(appShellHtml(template));
    expect(doc.title).toBe('FinControl');
    expect(doc.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]')).toHaveLength(0);
    expect(attr(doc, 'meta[name="robots"]', 'content')).toBe('noindex');
    expect(doc.getElementById('root')!.innerHTML).toBe('');
    expect(doc.getElementById('root')!.dataset.prerenderedRoute).toBeUndefined();
    expect(doc.querySelector('link[rel="canonical"]')).toBeNull();
    expect(doc.querySelector('meta[name="fincontrol-prerendered"]')).toBeNull();
    expect(doc.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(0);
    expect(doc.querySelector('script[type="module"]')).not.toBeNull();
    expectNoInlineScript(doc);
  });

  it('404.html: "não encontrada", com noindex e link para o início, sem carregar o app', () => {
    const doc = parse(notFoundHtml(template, renderNotFoundBody()));
    expect(attr(doc, 'meta[name="robots"]', 'content')).toBe('noindex');
    expect(doc.title).toBe('Página não encontrada — FinControl');
    expect(doc.querySelector('h1')?.textContent).toBe('Página não encontrada');
    expect(doc.querySelector('a[href="/"]')).not.toBeNull();
    expect(doc.querySelector('link[rel="canonical"]')).toBeNull();
    expect(doc.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(0);
    expect(doc.querySelector('script[type="module"]')).toBeNull();
    expect(doc.querySelector('link[rel="modulepreload"]')).toBeNull();
    expectNoInlineScript(doc);
  });
});
