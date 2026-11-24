import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CAPTURES } from './captures';
import { AUTH_RETURN_PARAMS } from '../../app/home-gate';
import { HERO_IMAGE_SIZES } from './hero';

// O Vitest roda a partir de apps/web.
const script = readFileSync(resolve(process.cwd(), 'public/theme-init.js'), 'utf8');

/** Roda o theme-init.js com as metas que o build põe no index.html e devolve os links que ele criou. */
function runThemeInit() {
  for (const [name, files] of Object.entries({ site: '/assets/site.js /assets/icone.js', app: '/assets/app.js', entrar: '/assets/entrar.js' })) {
    const meta = document.createElement('meta');
    meta.name = `fincontrol-chunk-${name}`;
    meta.content = files;
    document.head.appendChild(meta);
  }
  new Function(script)();
  return [...document.head.querySelectorAll('link')].map((l) => ({
    rel: l.rel,
    href: l.getAttribute('href'),
    srcset: l.getAttribute('imagesrcset'),
    sizes: l.getAttribute('imagesizes'),
  }));
}

describe('public/theme-init.js adianta a tela que vai abrir (Lighthouse do site)', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  it('na / sem sessão: a captura do herói (mesmo srcset e sizes da imagem) e o pedaço do site com as dependências', () => {
    const links = runThemeInit();
    const hero = links.find((l) => l.rel === 'preload');
    expect(hero?.srcset).toBe(CAPTURES.dashboardPhone.srcSet);
    expect(hero?.sizes).toBe(HERO_IMAGE_SIZES);
    expect(hero?.href).toBe(CAPTURES.dashboardPhone.src);
    expect(links.filter((l) => l.rel === 'modulepreload').map((l) => l.href)).toEqual(['/assets/site.js', '/assets/icone.js']);
  });

  it('com sessão guardada: só o pedaço do app, sem a imagem do site', () => {
    localStorage.setItem('sb-projeto-auth-token', '{}');
    const links = runThemeInit();
    expect(links.map((l) => [l.rel, l.href])).toEqual([['modulepreload', '/assets/app.js']]);
  });

  it('na volta do link de confirmação (?token_hash=…&type=signup), não adianta o site', () => {
    window.history.replaceState(null, '', '/?token_hash=x&type=signup');
    expect(runThemeInit()).toEqual([]);
  });

  it('usa a mesma lista de parâmetros de retorno do portão da /', () => {
    expect(script).toContain(`[${AUTH_RETURN_PARAMS.map((p) => `'${p}'`).join(', ')}]`);
  });
});
