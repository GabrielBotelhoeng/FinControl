// Aplica o tema guardado antes do app carregar (sub-projeto 16, L1); o padrão é o claro.
// Também adianta o site de apresentação (sub-projeto 17) e decide se o HTML estático vale (sub-projeto 18; ver o fim).
// Fica fora do index.html porque a CSP (auditoria final) não aceita script embutido.
try {
  var t = localStorage.getItem('fincontrol-theme');
  if (t === 'system') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  if (t === 'dark') {
    document.documentElement.dataset.theme = 'dark';
    document.querySelector('meta[name="theme-color"]').content = '#0B0D09';
  }
} catch {
  // Sem acesso ao armazenamento: fica o tema claro.
}

// HTML estático (sub-projeto 18, E3): as páginas públicas chegam já desenhadas do build. Ele só vale no caminho da página
// gerada (a meta "fincontrol-prerendered") e, na `/`, sem sessão guardada, fora do app instalado e sem retorno de login:
// as mesmas regras do portão da `/` (home-gate.tsx). Se não valer, `data-boot="app"` esconde o conteúdo gerado (o
// <style> do index.html) desde o primeiro quadro, e o main.tsx desenha o app do zero; se valer, ele hidrata.
//
// Site de apresentação (sub-projeto 17): adianta o que a tela que vai abrir precisa, sem esperar o app descobrir qual é.
// Na `/` sem sessão (e fora do app instalado), a captura do herói, que é o LCP; com o HTML estático, só ela: o JavaScript
// vem depois da primeira pintura (main.tsx), em vez de disputar a rede com ela (Lighthouse, sub-projeto 18). Sem o HTML
// estático, também o pedaço que monta o app (boot) e o da tela: o site, o app (com sessão) ou a entrada (em `/entrar`). O
// `imagesrcset`/`imagesizes` repetem os da imagem do herói (hero.tsx e captures.ts; conferidos por teste), e os nomes dos
// pedaços vêm das metas "fincontrol-chunk-*" que o build põe no index.html.
var path = location.pathname;
var prerendered = document.querySelector('meta[name="fincontrol-prerendered"]');
var isPrerenderedPage = !!prerendered && prerendered.content === path;
// Sem acesso ao armazenamento, a `/` não arrisca mostrar o site para quem pode estar logado; as páginas legais valem.
var staticPage = isPrerenderedPage && path !== '/';
try {
  var preload = function (name) {
    var meta = document.querySelector('meta[name="fincontrol-chunk-' + name + '"]');
    if (!meta) return;
    // A meta lista o pedaço e as dependências dele, separados por espaço.
    meta.content.split(' ').forEach(function (href) {
      var link = document.createElement('link');
      link.rel = 'modulepreload';
      link.href = href;
      document.head.appendChild(link);
    });
  };
  var signedIn = false;
  for (var i = 0; i < localStorage.length; i++) {
    if (/^sb-.+-auth-token$/.test(localStorage.key(i) || '')) signedIn = true;
  }
  var standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  // Volta do login com Google ou do link de confirmação de cadastro: a sessão chega pela URL e o app vai abrir, não o
  // site. A mesma lista do AUTH_RETURN_PARAMS de home-gate.tsx (teste).
  var authParams = ['access_token', 'refresh_token', 'code', 'token_hash', 'type', 'error', 'error_code', 'error_description'];
  var hashParams = new URLSearchParams(location.hash.slice(1));
  var queryParams = new URLSearchParams(location.search);
  var authReturn = authParams.some(function (p) {
    return hashParams.has(p) || queryParams.has(p);
  });
  var siteHome = path === '/' && !signedIn && !authReturn && !standalone;
  staticPage = isPrerenderedPage && (path !== '/' || siteHome);
  if (siteHome) {
    var hero = document.createElement('link');
    hero.rel = 'preload';
    hero.as = 'image';
    hero.href = '/site/painel-celular.webp';
    hero.setAttribute('imagesrcset', '/site/painel-celular-420.webp 420w, /site/painel-celular-560.webp 560w, /site/painel-celular.webp 780w');
    hero.setAttribute('imagesizes', '(min-width: 768px) 265px, 235px');
    hero.setAttribute('fetchpriority', 'high');
    document.head.appendChild(hero);
  }
  if (!staticPage) {
    preload('boot');
    if (path === '/entrar') preload('entrar');
    else if (signedIn) preload('app');
    else if (siteHome) preload('site');
  }
} catch {
  // Sem acesso ao armazenamento: cada tela carrega do jeito normal.
}
document.documentElement.dataset.boot = staticPage ? 'static' : 'app';
