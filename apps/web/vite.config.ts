import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin, ResolvedConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { prerenderPages } from './scripts/prerender.mjs';
import { appRoutePatterns, offlineAppPatterns } from './src/app/app-route-patterns';

/** Os rewrites do `vercel.json`: as rotas do app, que abrem a casca (`/app.html`). Fonte única da Vercel, do preview e do PWA. */
const { rewrites } = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as { rewrites: { source: string; destination: string }[] };

/**
 * HTML estático das páginas públicas, da casca do app e do 404 (sub-projeto 18, E1): no fim do build do cliente, antes do
 * service worker (o PWA roda depois, `closeBundleOrder: 'post'`), para o precache levar o HTML final e o `app.html`.
 */
function prerenderPublicPages(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'fincontrol-prerender',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    closeBundle: {
      sequential: true,
      order: 'pre',
      async handler() {
        // O próprio build SSR do prerender passa por este arquivo de configuração: nele, nada a fazer.
        if (config.build.ssr) return;
        const files = await prerenderPages({ root: config.root, outDir: resolve(config.root, config.build.outDir), mode: config.mode });
        config.logger.info(`HTML estático gerado: ${files.join(', ')}`);
      },
    },
  };
}

/**
 * O `vite preview` (E2E e Lighthouse locais) serve como a Vercel (sub-projeto 18, E5): primeiro o arquivo (as páginas
 * públicas são `pasta/index.html`), depois os rewrites do `vercel.json` (as rotas do app para `/app.html`) e, no resto, o
 * `404.html` com status 404. Sem isso, o fallback de SPA do preview serviria o index.html em qualquer caminho.
 */
function previewLikeVercel(): Plugin {
  return {
    name: 'fincontrol-preview-like-vercel',
    configurePreviewServer(server) {
      const root = server.config.root;
      const outDir = resolve(root, server.config.build.outDir);
      const patterns = appRoutePatterns(rewrites);
      const rules = rewrites.map((r, i) => ({ pattern: patterns[i]!, destination: r.destination }));
      const isFile = (path: string) => path.startsWith(outDir + sep) && existsSync(path) && statSync(path).isFile();
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        const url = new URL(req.url ?? '/', 'http://localhost');
        const path = decodeURIComponent(url.pathname);
        if (isFile(resolve(outDir, `.${path}`))) return next();
        if (isFile(resolve(outDir, `.${path}`, 'index.html'))) {
          req.url = `${path.replace(/\/?$/, '/')}index.html${url.search}`;
          return next();
        }
        const rule = rules.find((r) => r.pattern.test(path));
        if (rule) {
          req.url = `${rule.destination}${url.search}`;
          return next();
        }
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(readFileSync(resolve(outDir, '404.html')));
      });
    },
  };
}

/** Os pedaços que o `public/theme-init.js` adianta com modulepreload, conforme a rota e a sessão. */
const PRELOADED_CHUNKS = {
  // O pedaço que monta o app (o main.tsx o importa; sub-projeto 18).
  boot: '/src/boot.tsx',
  site: '/features/site/site-page.tsx',
  app: '/app/app-shell.tsx',
  entrar: '/features/auth/login-page.tsx',
};

/**
 * Põe no index.html o nome de cada pedaço adiantado (`<meta name="fincontrol-chunk-site">` etc.), para o
 * `public/theme-init.js` fazer o modulepreload certo: o site na `/` sem sessão, o app com sessão e a entrada em `/entrar`
 * (sub-projeto 17, Lighthouse). São metas, não script embutido: a CSP continua só com scripts do próprio site.
 */
function preloadChunkMetas(): Plugin {
  return {
    name: 'fincontrol-preloads',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle ?? {};
        const chunks = Object.values(bundle);
        // O pedaço e tudo o que ele importa direto (ícones, utilitários…): sem isso, as dependências só seriam pedidas
        // depois que ele chegasse, numa segunda volta da cascata.
        const withImports = (fileName: string, seen = new Set<string>()): string[] => {
          if (seen.has(fileName)) return [];
          seen.add(fileName);
          const chunk = bundle[fileName];
          const imports = chunk?.type === 'chunk' ? chunk.imports : [];
          return [fileName, ...imports.flatMap((f) => withImports(f, seen))];
        };
        const metas = Object.entries(PRELOADED_CHUNKS).flatMap(([name, entry]) => {
          const chunk = chunks.find((c) => c.type === 'chunk' && c.facadeModuleId?.endsWith(entry));
          if (!chunk) throw new Error(`Pedaço não encontrado para o modulepreload: ${entry}`);
          const files = withImports(chunk.fileName).map((f) => `/${f}`).join(' ');
          return `<meta name="fincontrol-chunk-${name}" content="${files}" />`;
        });
        // As fontes latinas (Outfit e Manrope) começam a baixar junto com o CSS: sem isso, o texto troca de fonte depois
        // da primeira pintura e empurra o que está embaixo (CLS). Vale para o app inteiro, não só para o site.
        const fonts = Object.values(ctx.bundle ?? {})
          .filter((a) => a.type === 'asset' && /\/(outfit|manrope)-latin-wght-normal-[\w-]+\.woff2$/.test(`/${a.fileName}`))
          .map((a) => ({
            tag: 'link',
            attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `/${a.fileName}`, crossorigin: '' },
            injectTo: 'head' as const,
          }));
        if (fonts.length !== 2) throw new Error(`Esperava as 2 fontes latinas para o preload, achei ${fonts.length}.`);
        // As metas vão logo depois do charset (que precisa ficar nos primeiros 1024 bytes) e antes do theme-init.js.
        const charset = '<meta charset="UTF-8" />';
        if (!html.includes(charset)) throw new Error('index.html sem <meta charset="UTF-8" />');
        const indent = '\n    ';
        return { html: html.replace(charset, charset + indent + metas.join(indent)), tags: fonts };
      },
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    preloadChunkMetas(),
    prerenderPublicPages(),
    previewLikeVercel(),
    VitePWA({
      registerType: 'autoUpdate',
      // O service worker é gerado depois do HTML estático (plugin acima), para o precache levar a versão final.
      integration: { closeBundleOrder: 'post' },
      // O registro do service worker não segura a primeira pintura (Lighthouse do site, sub-projeto 17).
      injectRegister: 'script-defer',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'FinControl',
        short_name: 'FinControl',
        description: 'Saiba quanto ganha, quanto gasta e para onde vai o seu dinheiro.',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        // O fundo do tema claro, que é o padrão (sub-projeto 16, L1 e L9).
        background_color: '#F5F6F0',
        theme_color: '#F5F6F0',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Atalhos no ícone do app instalado (segurar o ícone no Android, botão direito no computador).
        shortcuts: [
          { name: 'Novo lançamento', short_name: 'Lançar', url: '/lancamentos?novo=1', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
          { name: 'Calendário de contas', short_name: 'Calendário', url: '/calendario', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
          { name: 'Importar extrato', short_name: 'Importar', url: '/importar', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        // Só o shell do app vai para o cache; dados da API nunca (spec 3.2: sem dados offline).
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        // As fotos do site de apresentação não vão para o cache de quem instala o app (sub-projeto 17, S10).
        globIgnores: ['site/**', 'og-image.png'],
        // O app instalado abre a casca do app só nas rotas do app (as mesmas do vercel.json). As páginas públicas vêm do HTML
        // gerado, e um caminho desconhecido vai à rede e recebe o 404 de verdade (sub-projeto 18, seção 3 da spec; CodeRabbit).
        navigateFallback: '/app.html',
        // O Workbox compara caminho + query: o atalho /lancamentos?novo=1 também abre a casca offline.
        navigateFallbackAllowlist: offlineAppPatterns(rewrites),
        // Web Push (sub-projeto 5, Parte B, W7): o tratamento do aviso e do clique fica em public/push-sw.js.
        importScripts: ['push-sw.js'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
