/**
 * Versão nova do app (sub-projeto 19). O service worker novo assume sozinho (`skipWaiting` + `clientsClaim`, A1), mas a
 * página aberta não recarrega: ela só avisa (A2), para não perder um formulário pela metade. Começa no main.tsx, antes de o
 * app montar, para não perder uma troca que aconteça durante o boot; o aviso em si é o `UpdateNotice` (app/update-notice).
 */

/** De quanto em quanto tempo a aba aberta confere se há um `sw.js` novo (A3). */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** A trava da recarga única quando o boot não carrega (A4). Fica no `sessionStorage`: vale só para esta aba. */
export const RELOAD_GUARD_KEY = 'fincontrol-recarga-versao';

let available = false;
const listeners = new Set<() => void>();

function announce() {
  available = true;
  for (const listener of listeners) listener();
}

/** Chama `listener` quando houver versão nova (na hora, se ela já foi vista). Devolve a função que cancela. */
export function onUpdateAvailable(listener: () => void): () => void {
  listeners.add(listener);
  if (available) listener();
  return () => {
    listeners.delete(listener);
  };
}

export function resetUpdateStateForTests() {
  available = false;
  listeners.clear();
}

/**
 * Liga o que percebe a versão nova: a troca do controlador (o SW novo assumiu), a procura ao voltar para a aba e a cada
 * 60 min (A3) e o `vite:preloadError`, que o Vite dispara quando um `import()` falha, como um pedaço antigo que sumiu da
 * Vercel depois do deploy (A4). Devolve a função que desliga tudo.
 */
export function watchForUpdates({
  container = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined,
}: { container?: ServiceWorkerContainer } = {}): () => void {
  // O erro segue o caminho dele (a tela de erro das rotas); aqui só se mostra o aviso.
  const onPreloadError = () => announce();
  window.addEventListener('vite:preloadError', onPreloadError);
  if (!container) return () => window.removeEventListener('vite:preloadError', onPreloadError);

  // A página abriu sob um service worker? Então a próxima troca de controlador é uma versão nova. Sem controlador, a
  // primeira troca é só a primeira instalação assumindo, exceto na recarga forçada (Shift+F5), em que o SW já está ativo.
  let controlled = container.controller !== null;
  void container.getRegistration().then(
    (registration) => {
      if (registration?.active) controlled = true;
    },
    () => {},
  );
  const onControllerChange = () => {
    if (controlled) announce();
    controlled = true;
  };
  const check = () => {
    container
      .getRegistration()
      .then((registration) => registration?.update())
      .catch(() => {
        // Sem conexão ou servidor fora: a próxima procura tenta de novo.
      });
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') check();
  };
  container.addEventListener('controllerchange', onControllerChange);
  document.addEventListener('visibilitychange', onVisibility);
  const timer = setInterval(check, UPDATE_CHECK_INTERVAL_MS);
  return () => {
    window.removeEventListener('vite:preloadError', onPreloadError);
    container.removeEventListener('controllerchange', onControllerChange);
    document.removeEventListener('visibilitychange', onVisibility);
    clearInterval(timer);
  };
}

/**
 * O boot do app não carregou (A4): recarrega a página uma vez, porque ainda não há nada montado que se perca. A trava no
 * `sessionStorage` impede o laço se a falha continuar (servidor fora do ar); sem acesso a ele, não recarrega. Só a trava é
 * gravada: a sessão e os dados não são tocados (A5).
 */
export function reloadOnce(reload: () => void = () => window.location.reload()): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_GUARD_KEY) !== null) return false;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  reload();
  return true;
}

/** O app montou: a trava sai, e uma falha num deploy futuro pode recarregar de novo. */
export function clearReloadGuard() {
  try {
    sessionStorage.removeItem(RELOAD_GUARD_KEY);
  } catch {
    // Sem acesso ao armazenamento: não há trava para tirar.
  }
}
