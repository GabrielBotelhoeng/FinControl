import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CAPTURES } from './captures';
import { AUTH_RETURN_PARAMS } from '../../app/home-gate';
import { HERO_IMAGE_SIZES } from './hero';

// O Vitest roda a partir de apps/web.
const script = readFileSync(resolve(process.cwd(), 'public/theme-init.js'), 'utf8');

/** Roda o theme-init.js com as metas que o build põe no index.html e devolve os links que ele criou. */
function runThemeInit(prerendered?: string) {
  if (prerendered) {
    const meta = document.createElement('meta');
    meta.name = 'fincontrol-prerendered';
    meta.content = prerendered;
    document.head.appendChild(meta);
  }
  for (const [name, files] of Object.entries({ boot: '/assets/boot.js', site: '/assets/site.js /assets/icone.js', app: '/assets/app.js', entrar: '/assets/entrar.js' })) {
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
    expect(links.filter((l) => l.rel === 'modulepreload').map((l) => l.href)).toEqual(['/assets/boot.js', '/assets/site.js', '/assets/icone.js']);
  });

  it('na / com o HTML estático: só a captura do herói; o JavaScript vem depois da primeira pintura (sub-projeto 18)', () => {
    const links = runThemeInit('/');
    expect(links.map((l) => [l.rel, l.href])).toEqual([['preload', CAPTURES.dashboardPhone.src]]);
  });

  it('nas páginas legais com o HTML estático: nada adiantado, nem com sessão', () => {
    localStorage.setItem('sb-projeto-auth-token', '{}');
    window.history.replaceState(null, '', '/termos');
    expect(runThemeInit('/termos')).toEqual([]);
  });

  it('com sessão guardada: só o pedaço do app, sem a imagem do site', () => {
    localStorage.setItem('sb-projeto-auth-token', '{}');
    const links = runThemeInit();
    expect(links.map((l) => [l.rel, l.href])).toEqual([
      ['modulepreload', '/assets/boot.js'],
      ['modulepreload', '/assets/app.js'],
    ]);
  });

  it('na volta do link de confirmação (?token_hash=…&type=signup), não adianta o site', () => {
    window.history.replaceState(null, '', '/?token_hash=x&type=signup');
    expect(runThemeInit('/').map((l) => l.href)).toEqual(['/assets/boot.js']);
  });

  it('usa a mesma lista de parâmetros de retorno do portão da /', () => {
    expect(script).toContain(`[${AUTH_RETURN_PARAMS.map((p) => `'${p}'`).join(', ')}]`);
  });
});

/** Roda o theme-init.js numa página gerada no build (`prerendered`) ou na casca do app (sem a meta). */
function bootFor(url: string, prerendered?: string) {
  window.history.replaceState(null, '', url);
  if (prerendered) {
    const meta = document.createElement('meta');
    meta.name = 'fincontrol-prerendered';
    meta.content = prerendered;
    document.head.appendChild(meta);
  }
  new Function(script)();
  return document.documentElement.dataset.boot;
}

describe('public/theme-init.js decide se o HTML estático vale, antes da pintura (sub-projeto 18, E3)', () => {
  const originalMatchMedia = window.matchMedia;
  afterEach(() => {
    document.head.innerHTML = '';
    delete document.documentElement.dataset.boot;
    localStorage.clear();
    window.matchMedia = originalMatchMedia;
    window.history.replaceState(null, '', '/');
  });

  it('na / gerada, sem sessão, fora do app instalado e sem retorno de login: vale (hidrata)', () => {
    expect(bootFor('/', '/')).toBe('static');
  });

  it('com sessão guardada na /: não vale (o painel abre sem o site aparecer)', () => {
    localStorage.setItem('sb-ojywswdjhjmwnfhalntl-auth-token', '{}');
    expect(bootFor('/', '/')).toBe('app');
  });

  it('no app instalado na /: não vale (abre a entrada)', () => {
    window.matchMedia = ((query: string) => ({ ...originalMatchMedia(query), matches: query === '(display-mode: standalone)' })) as typeof window.matchMedia;
    expect(bootFor('/', '/')).toBe('app');
  });

  it.each(AUTH_RETURN_PARAMS)('no retorno de login com "%s" na URL: não vale', (param) => {
    expect(bootFor(`/?${param}=x`, '/')).toBe('app');
    document.head.innerHTML = '';
    expect(bootFor(`/#${param}=x`, '/')).toBe('app');
  });

  it('nas páginas legais geradas, vale mesmo com sessão (são as mesmas para todo mundo)', () => {
    localStorage.setItem('sb-ojywswdjhjmwnfhalntl-auth-token', '{}');
    expect(bootFor('/privacidade', '/privacidade')).toBe('static');
    document.head.innerHTML = '';
    expect(bootFor('/termos', '/termos')).toBe('static');
  });

  it('fora da rota gerada (casca do app, ou um HTML servido em outro caminho): não vale', () => {
    expect(bootFor('/lancamentos')).toBe('app');
    document.head.innerHTML = '';
    expect(bootFor('/lancamentos', '/')).toBe('app');
    document.head.innerHTML = '';
    expect(bootFor('/privacidade/', '/privacidade')).toBe('app');
  });

  it('o index.html esconde o conteúdo gerado quando não vale, com <style> (a CSP permite estilo embutido, não script)', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    expect(html).toMatch(/<style>[^<]*html\[data-boot="app"\] #root\[data-prerendered-route\][^<]*display:\s*none[^<]*<\/style>/);
    // O <style> vem antes do theme-init.js, para valer já no primeiro quadro.
    expect(html.indexOf('<style>')).toBeLessThan(html.indexOf('<script src="/theme-init.js">'));
  });
});
