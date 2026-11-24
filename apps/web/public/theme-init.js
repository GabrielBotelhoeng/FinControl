// Aplica o tema guardado antes do app carregar (sub-projeto 16, L1); o padrão é o claro.
// Também adianta o site de apresentação (sub-projeto 17; ver o fim do arquivo).
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

// Site de apresentação (sub-projeto 17): adianta o pedaço de JavaScript da tela que vai abrir, sem esperar o app
// descobrir qual é: na `/` sem sessão (e fora do app instalado), o site e a captura do herói, que é o LCP; com sessão,
// o app; em `/entrar`, a entrada. O `imagesrcset`/`imagesizes` repetem os da imagem do herói (hero.tsx e captures.ts;
// conferidos por teste), e os nomes dos pedaços vêm das metas "fincontrol-chunk-*" que o build põe no index.html.
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
  var path = location.pathname;
  if (path === '/entrar') {
    preload('entrar');
  } else if (signedIn) {
    preload('app');
  } else if (path === '/' && !matchMedia('(display-mode: standalone)').matches) {
    var hero = document.createElement('link');
    hero.rel = 'preload';
    hero.as = 'image';
    hero.href = '/site/painel-celular.webp';
    hero.setAttribute('imagesrcset', '/site/painel-celular-420.webp 420w, /site/painel-celular-560.webp 560w, /site/painel-celular.webp 780w');
    hero.setAttribute('imagesizes', '(min-width: 768px) 265px, 235px');
    hero.setAttribute('fetchpriority', 'high');
    document.head.appendChild(hero);
    preload('site');
  }
} catch {
  // Sem acesso ao armazenamento: cada tela carrega do jeito normal.
}
