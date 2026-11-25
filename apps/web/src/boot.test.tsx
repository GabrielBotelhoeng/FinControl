import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const preloadPublicPage = vi.fn<(path: string) => Promise<unknown>>();
const hydrateRoot = vi.fn();
const render = vi.fn();
const createRoot = vi.fn(() => ({ render }));

vi.mock('./app/routes', () => ({ preloadPublicPage: (path: string) => preloadPublicPage(path) }));
vi.mock('./app/router', () => ({ router: {} }));
vi.mock('react-dom/client', () => ({ hydrateRoot: (...args: unknown[]) => hydrateRoot(...args), createRoot: () => createRoot() }));
vi.mock('./lib/env', () => ({
  checkEnv: () => ({ ok: true, env: { VITE_API_URL: 'http://api', VITE_SUPABASE_URL: 'http://auth', VITE_SUPABASE_ANON_KEY: 'k' } }),
}));

const { boot } = await import('./boot');

/** O #root como o build o entrega: com o HTML estático da página. */
function staticRoot() {
  const root = document.createElement('div');
  root.dataset.prerenderedRoute = '/';
  root.innerHTML = '<h1>Seu dinheiro, sob controle.</h1>';
  document.body.appendChild(root);
  return root;
}

describe('boot: o pedaço da página pública não carrega (CodeRabbit, PR #40)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    preloadPublicPage.mockReset();
    hydrateRoot.mockReset();
    createRoot.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('tenta de novo e só hidrata quando o pedaço chega', async () => {
    preloadPublicPage.mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce({});
    const root = staticRoot();
    const done = boot(root, true);
    await vi.advanceTimersByTimeAsync(0);
    expect(hydrateRoot).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    await done;
    expect(preloadPublicPage).toHaveBeenCalledTimes(2);
    expect(hydrateRoot).toHaveBeenCalledTimes(1);
    expect(createRoot).not.toHaveBeenCalled();
  });

  it('se todas as tentativas falham, o HTML estático fica na tela, sem hidratar, até a conexão voltar', async () => {
    preloadPublicPage.mockRejectedValue(new Error('rede'));
    const root = staticRoot();
    const done = boot(root, true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(preloadPublicPage).toHaveBeenCalledTimes(3);
    expect(hydrateRoot).not.toHaveBeenCalled();
    expect(createRoot).not.toHaveBeenCalled();
    expect(root.querySelector('h1')?.textContent).toBe('Seu dinheiro, sob controle.');

    // A conexão volta e o pedaço chega: agora sim, hidrata.
    preloadPublicPage.mockReset();
    preloadPublicPage.mockResolvedValue({});
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    await done;
    expect(hydrateRoot).toHaveBeenCalledTimes(1);
  });
});
