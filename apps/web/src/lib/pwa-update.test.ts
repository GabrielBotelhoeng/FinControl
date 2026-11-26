import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RELOAD_GUARD_KEY,
  UPDATE_CHECK_INTERVAL_MS,
  clearReloadGuard,
  onUpdateAvailable,
  reloadOnce,
  resetUpdateStateForTests,
  watchForUpdates,
} from './pwa-update';

/** Um `ServiceWorkerContainer` de mentira: controlador, registro e o evento `controllerchange`. */
function fakeContainer({ controller = false, active = false }: { controller?: boolean; active?: boolean } = {}) {
  const events = new EventTarget();
  const update = vi.fn(() => Promise.resolve());
  const registration = { active: active || controller ? {} : null, update };
  const container = {
    controller: controller ? ({} as ServiceWorker) : null,
    getRegistration: vi.fn(() => Promise.resolve(controller || active ? registration : undefined)),
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  const changeController = () => {
    container.controller = {} as ServiceWorker;
    events.dispatchEvent(new Event('controllerchange'));
  };
  return { container: container as unknown as ServiceWorkerContainer, update, changeController };
}

const flush = () => new Promise((done) => setTimeout(done, 0));

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('watchForUpdates', () => {
  let stop: () => void = () => {};
  let seen: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    resetUpdateStateForTests();
    seen = vi.fn<() => void>();
  });
  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  it('na primeira instalação (sem controlador nem registro), o SW assumir não é versão nova', async () => {
    const sw = fakeContainer();
    stop = watchForUpdates({ container: sw.container });
    onUpdateAvailable(seen);
    await flush();
    sw.changeController();
    expect(seen).not.toHaveBeenCalled();
    // Uma troca depois disso já é uma versão nova.
    sw.changeController();
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('com a página controlada, a troca do controlador avisa da versão nova', () => {
    const sw = fakeContainer({ controller: true });
    stop = watchForUpdates({ container: sw.container });
    onUpdateAvailable(seen);
    sw.changeController();
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('na recarga forçada (sem controlador, mas com SW ativo), a troca também avisa', async () => {
    const sw = fakeContainer({ active: true });
    stop = watchForUpdates({ container: sw.container });
    onUpdateAvailable(seen);
    await flush();
    sw.changeController();
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('quem se inscreve depois do aviso recebe na hora', () => {
    const sw = fakeContainer({ controller: true });
    stop = watchForUpdates({ container: sw.container });
    sw.changeController();
    onUpdateAvailable(seen);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('procura atualização ao voltar para a aba, e não ao sair dela', async () => {
    const sw = fakeContainer({ controller: true });
    stop = watchForUpdates({ container: sw.container });
    setVisibility('hidden');
    await flush();
    expect(sw.update).not.toHaveBeenCalled();
    setVisibility('visible');
    await flush();
    expect(sw.update).toHaveBeenCalledTimes(1);
  });

  it('procura atualização a cada 60 minutos', async () => {
    vi.useFakeTimers();
    const sw = fakeContainer({ controller: true });
    stop = watchForUpdates({ container: sw.container });
    expect(UPDATE_CHECK_INTERVAL_MS).toBe(60 * 60 * 1000);
    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS - 1);
    expect(sw.update).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(sw.update).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS);
    expect(sw.update).toHaveBeenCalledTimes(2);
  });

  it('sem conexão, a procura falha em silêncio', async () => {
    const sw = fakeContainer({ controller: true });
    sw.update.mockRejectedValueOnce(new Error('offline'));
    stop = watchForUpdates({ container: sw.container });
    setVisibility('visible');
    await flush();
    expect(sw.update).toHaveBeenCalledTimes(1);
  });

  it('um pedaço que não carrega (vite:preloadError) mostra o mesmo aviso, mesmo sem service worker', () => {
    stop = watchForUpdates({ container: undefined });
    onUpdateAvailable(seen);
    window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('não impede o erro do pedaço de seguir (a tela de erro das rotas trata)', () => {
    stop = watchForUpdates({ container: undefined });
    const event = new Event('vite:preloadError', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('desligar remove os ouvintes e o relógio', async () => {
    vi.useFakeTimers();
    const sw = fakeContainer({ controller: true });
    watchForUpdates({ container: sw.container })();
    onUpdateAvailable(seen);
    sw.changeController();
    window.dispatchEvent(new Event('vite:preloadError'));
    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS);
    expect(seen).not.toHaveBeenCalled();
    expect(sw.update).not.toHaveBeenCalled();
  });

  it('cancelar a inscrição para de receber', () => {
    const sw = fakeContainer({ controller: true });
    stop = watchForUpdates({ container: sw.container });
    onUpdateAvailable(seen)();
    sw.changeController();
    expect(seen).not.toHaveBeenCalled();
  });
});

describe('reloadOnce', () => {
  beforeEach(() => sessionStorage.clear());

  it('recarrega uma vez e, com a trava, não recarrega de novo (sem laço)', () => {
    const reload = vi.fn();
    expect(reloadOnce(reload)).toBe(true);
    expect(sessionStorage.getItem(RELOAD_GUARD_KEY)).not.toBeNull();
    expect(reloadOnce(reload)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('depois que o app monta, a trava sai e uma falha futura pode recarregar', () => {
    const reload = vi.fn();
    reloadOnce(reload);
    clearReloadGuard();
    expect(sessionStorage.getItem(RELOAD_GUARD_KEY)).toBeNull();
    expect(reloadOnce(reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('não mexe no resto do armazenamento (a sessão continua)', () => {
    localStorage.setItem('sb-ref-auth-token', '{"access_token":"x"}');
    sessionStorage.setItem('outra-coisa', '1');
    reloadOnce(vi.fn());
    clearReloadGuard();
    expect(localStorage.getItem('sb-ref-auth-token')).toBe('{"access_token":"x"}');
    expect(sessionStorage.getItem('outra-coisa')).toBe('1');
  });

  it('sem acesso ao armazenamento, não recarrega (não arrisca o laço)', () => {
    const reload = vi.fn();
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(reloadOnce(reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
