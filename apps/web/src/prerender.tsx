/**
 * HTML estático das páginas públicas (sub-projeto 18, E1, E2, E6 e E7). Roda só no build, em Node (scripts/prerender.mjs
 * faz o build SSR desta entrada): sem window, document nem localStorage. As páginas são renderizadas com a mesma árvore
 * do navegador (main.tsx: os providers e as mesmas rotas), para o cliente hidratar exatamente este HTML.
 */
import { StrictMode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { prerenderToNodeStream } from 'react-dom/static';
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from 'react-router';
import { NotFoundPage } from './app/not-found-page';
import { AppProviders } from './app/providers';
import { routes } from './app/routes';
import type { AuthGateway } from './features/auth/gateway';
import type { WebEnv } from './lib/env';
import { headEntries, PUBLIC_HEAD, SITE_URL, type PublicPath } from './lib/public-head';

export const PRERENDERED_PATHS = Object.keys(PUBLIC_HEAD) as PublicPath[];

/** No build não há sessão: a conferência fica "carregando" e o portão da `/` desenha o site (home-gate.tsx). */
const neverSignedIn: AuthGateway = {
  getSession: () => new Promise(() => {}),
  onChange: () => () => {},
  signInWithPassword: () => Promise.reject(new Error('Indisponível no build')),
  signUp: () => Promise.reject(new Error('Indisponível no build')),
  signInWithGoogle: () => Promise.reject(new Error('Indisponível no build')),
  signInAnonymously: () => Promise.reject(new Error('Indisponível no build')),
  resetPassword: () => Promise.reject(new Error('Indisponível no build')),
  signOut: () => Promise.resolve(),
};

// Nenhuma chamada sai do build; o endereço só precisa existir para montar o cliente da API.
const BUILD_ENV: WebEnv = { VITE_API_URL: `${SITE_URL}/api/v1`, VITE_SUPABASE_URL: SITE_URL, VITE_SUPABASE_ANON_KEY: 'build' };

/** O HTML do `#root` de uma rota pública, esperando os pedaços em `lazy` (o `prerender` espera os Suspense). */
export async function renderRoute(path: PublicPath): Promise<string> {
  const handler = createStaticHandler(routes);
  const context = await handler.query(new Request(`${SITE_URL}${path}`));
  if (context instanceof Response) throw new Error(`A rota ${path} respondeu com redirecionamento no build`);
  const router = createStaticRouter(handler.dataRoutes, context);
  const { prelude } = await prerenderToNodeStream(
    <StrictMode>
      <AppProviders env={BUILD_ENV} gateway={neverSignedIn}>
        {/* Sem `hydrate`: os dados de hidratação viriam num script embutido, que a CSP não aceita (e não há loaders). */}
        <StaticRouterProvider router={router} context={context} hydrate={false} />
      </AppProviders>
    </StrictMode>,
  );
  let html = '';
  for await (const chunk of prelude) html += chunk;
  // O React adianta a imagem do herói com um <link rel="preload"> no começo do HTML. Ele sai daqui: no #root, o cliente
  // não o espera na hidratação, e o public/theme-init.js já faz o mesmo preload no <head> quando o HTML estático vale.
  return html.replace(/^(?:<link [^>]*\/>)+/, '');
}

export const renderNotFoundBody = () => renderToStaticMarkup(<NotFoundPage />);

const escapeAttr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Troca `pattern` uma vez, e falha se o modelo do index.html mudou e ele não existe mais (melhor quebrar o build). */
function replaceOnce(html: string, pattern: RegExp | string, replacement: string, what: string): string {
  const found = typeof pattern === 'string' ? html.includes(pattern) : pattern.test(html);
  if (!found) throw new Error(`index.html sem ${what}`);
  return html.replace(pattern, () => replacement);
}

/** `meta[name="description"]` → a tag `<meta name="description" …>` do HTML. */
function tagPattern(selector: string): RegExp {
  const match = /^(\w+)\[([\w:-]+)="([^"]+)"\]$/.exec(selector);
  if (!match) throw new Error(`Seletor não suportado: ${selector}`);
  const [, tag, key, value] = match;
  return new RegExp(`<${tag}\\s[^>]*${key}="${escapeRe(value!)}"[^>]*>`);
}

function setAttribute(html: string, selector: string, attribute: string, value: string): string {
  const pattern = tagPattern(selector);
  const tag = pattern.exec(html)?.[0];
  if (!tag) throw new Error(`index.html sem ${selector}`);
  return html.replace(tag, tag.replace(new RegExp(`${attribute}="[^"]*"`), `${attribute}="${escapeAttr(value)}"`));
}

const setTitle = (html: string, title: string) => replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${escapeAttr(title)}</title>`, '<title>');

/** O JSON-LD (e o comentário que o explica) só fica na home (E6). */
const removeJsonLd = (html: string) =>
  replaceOnce(html, /(\s*<!--[^>]*Dados estruturados[\s\S]*?-->)?\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/, '', 'o JSON-LD');

const removeTag = (html: string, selector: string) => replaceOnce(html, new RegExp(`\\s*${tagPattern(selector).source}`), '', selector);

const THEME_INIT = '<script src="/theme-init.js"></script>';
/** Metas que precisam vir antes do theme-init.js (ele roda no <head>, antes da pintura). */
const beforeThemeInit = (html: string, tags: string) => replaceOnce(html, THEME_INIT, `${tags}\n    ${THEME_INIT}`, 'o theme-init.js');
const NOINDEX = '<meta name="robots" content="noindex" />';
const EMPTY_ROOT = '<div id="root"></div>';

/** A página pública com o conteúdo gerado no `#root` e a cabeça própria (E1 e E6). */
export function pageHtml(template: string, path: PublicPath, body: string): string {
  let html = setTitle(template, PUBLIC_HEAD[path].title);
  for (const [selector, attribute, value] of headEntries(path)) html = setAttribute(html, selector, attribute, value);
  if (path !== '/') html = removeJsonLd(html);
  // O theme-init.js decide por esta meta se o HTML estático vale (E3); o main.tsx, pelo atributo do #root.
  html = beforeThemeInit(html, `<meta name="fincontrol-prerendered" content="${path}" />`);
  return replaceOnce(html, EMPTY_ROOT, `<div id="root" data-prerendered-route="${path}">${body}</div>`, 'o #root vazio');
}

/**
 * A casca do app (`dist/app.html`): a entrada e as rotas privadas, sem o HTML do site e fora do índice (E2 e E7). Sem
 * canonical nem as metas de compartilhamento da home (og:*, twitter:*): elas apontariam para a `/`. O título é só a marca;
 * as telas do app trocam o título.
 */
export function appShellHtml(template: string): string {
  let html = setTitle(template, 'FinControl');
  html = removeTag(html, 'link[rel="canonical"]');
  html = html.replace(/\s*<meta (?:property="og:|name="twitter:)[^>]*>/g, '');
  html = removeJsonLd(html);
  return beforeThemeInit(html, NOINDEX);
}

/** A página 404 (`dist/404.html`): HTML puro, sem o JavaScript do app, fora do índice (E5 e E7). */
export function notFoundHtml(template: string, body: string): string {
  let html = setTitle(template, 'Página não encontrada — FinControl');
  html = removeTag(html, 'link[rel="canonical"]');
  html = removeTag(html, 'meta[property="og:url"]');
  html = removeJsonLd(html);
  html = beforeThemeInit(html, NOINDEX);
  // Nada do app: sem o módulo de entrada, sem os modulepreload e sem as metas dos pedaços que o theme-init.js adianta.
  html = html.replace(/\s*<script type="module"[^>]*><\/script>/g, '');
  html = html.replace(/\s*<link rel="modulepreload"[^>]*>/g, '');
  html = html.replace(/\s*<meta name="fincontrol-chunk-[^>]*>/g, '');
  return replaceOnce(html, EMPTY_ROOT, `<div id="root">${body}</div>`, 'o #root vazio');
}
