// @ts-check
/**
 * HTML estático das páginas públicas (sub-projeto 18, E1): build SSR de `src/prerender.tsx`, render de cada rota pública
 * e escrita, em `dist/`, de `index.html`, `privacidade/index.html`, `termos/index.html`, `app.html` (a casca do app) e
 * `404.html`. Roda no fim do `vite build` (plugin "fincontrol-prerender" do vite.config.ts), antes do service worker ser
 * gerado, para o precache do PWA já levar o HTML final e a casca do app.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

/**
 * @param {{ root: string; outDir: string; mode: string }} options a pasta da web, a saída do build do cliente e o modo
 * @returns {Promise<string[]>} os arquivos escritos, relativos a `outDir`
 */
export async function prerenderPages({ root, outDir, mode }) {
  const ssrOutDir = resolve(root, 'node_modules/.prerender');
  await build({
    root,
    mode,
    configFile: resolve(root, 'vite.config.ts'),
    logLevel: 'warn',
    build: { ssr: 'src/prerender.tsx', outDir: ssrOutDir, emptyOutDir: true, copyPublicDir: false, minify: false },
  });
  try {
    const entry = await import(pathToFileURL(resolve(ssrOutDir, 'prerender.js')).href);
    // O modelo é o index.html que o Vite acabou de gerar (com os nomes dos pedaços, o CSS e as metas de preload).
    const template = await readFile(resolve(outDir, 'index.html'), 'utf8');
    /** @type {[string, string][]} */
    const pages = [];
    for (const path of entry.PRERENDERED_PATHS) {
      const file = path === '/' ? 'index.html' : `${path.slice(1)}/index.html`;
      pages.push([file, entry.pageHtml(template, path, await entry.renderRoute(path))]);
    }
    pages.push(['app.html', entry.appShellHtml(template)], ['404.html', entry.notFoundHtml(template, entry.renderNotFoundBody())]);
    for (const [file, html] of pages) {
      const target = resolve(outDir, file);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, html);
    }
    return pages.map(([file]) => file);
  } finally {
    await rm(ssrOutDir, { recursive: true, force: true });
  }
}
