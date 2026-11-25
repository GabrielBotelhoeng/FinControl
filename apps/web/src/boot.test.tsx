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

const { boot, BOOT_RETRY_DELAYS } = await import('./boot');

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
    await vi.advanceTimersByTimeAsync(BOOT_RETRY_DELAYS[0]!);
    await done;
    expect(preloadPublicPage).toHaveBeenCalledTimes(2);
    expect(hydrateRoot).toHaveBeenCalledTimes(1);
    expect(createRoot).not.toHaveBeenCalled();
  });

  it('(a) o evento online durante a tentativa pendente não trava: a espera seguinte acontece mesmo assim', async () => {
    let failPending: (error: Error) => void = () => {};
    preloadPublicPage
      .mockRejectedValueOnce(new Error('rede'))
      .mockImplementationOnce(() => new Promise((_, reject) => (failPending = reject)))
      .mockResolvedValueOnce({});
    const done = boot(staticRoot(), true);
    await vi.advanceTimersByTimeAsync(BOOT_RETRY_DELAYS[0]!);
    expect(preloadPublicPage).toHaveBeenCalledTimes(2);
    // A conexão volta enquanto a 2ª tentativa ainda está pendente, e ela falha depois.
    window.dispatchEvent(new Event('online'));
    failPending(new Error('rede'));
    await vi.advanceTimersByTimeAsync(BOOT_RETRY_DELAYS[1]!);
    await done;
    expect(preloadPublicPage).toHaveBeenCalledTimes(3);
    expect(hydrateRoot).toHaveBeenCalledTimes(1);
  });

  it('(b) online, com o servidor falhando sempre: tenta com espera crescente e limitada e desiste (o main.tsx solta os toques), sem hidratar', async () => {
    preloadPublicPage.mockRejectedValue(new Error('500'));
    const root = staticRoot();
    const done = boot(root, true);
    const settled = expect(done).rejects.toThrow('500');
    for (let i = 1; i < BOOT_RETRY_DELAYS.length; i++) expect(BOOT_RETRY_DELAYS[i]!).toBeGreaterThanOrEqual(BOOT_RETRY_DELAYS[i - 1]!);
    expect(Math.max(...BOOT_RETRY_DELAYS)).toBeLessThanOrEqual(30_000);
    await vi.advanceTimersByTimeAsync(BOOT_RETRY_DELAYS.reduce((a, b) => a + b, 0));
    await settled;
    expect(preloadPublicPage).toHaveBeenCalledTimes(BOOT_RETRY_DELAYS.length + 1);
    expect(hydrateRoot).not.toHaveBeenCalled();
    expect(createRoot).not.toHaveBeenCalled();
    expect(root.querySelector('h1')?.textContent).toBe('Seu dinheiro, sob controle.');
  });

  it.each([
    ['o toque na página', (root: HTMLElement) => root.querySelector('h1')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))],
    ['a volta para a aba', () => document.dispatchEvent(new Event('visibilitychange'))],
    ['a conexão voltar', () => window.dispatchEvent(new Event('online'))],
  ])('na espera, %s tenta de novo na hora', async (_, wake) => {
    preloadPublicPage.mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce({});
    const root = staticRoot();
    const done = boot(root, true);
    await vi.advanceTimersByTimeAsync(0);
    expect(preloadPublicPage).toHaveBeenCalledTimes(1);
    wake(root);
    await vi.advanceTimersByTimeAsync(0);
    await done;
    expect(preloadPublicPage).toHaveBeenCalledTimes(2);
    expect(hydrateRoot).toHaveBeenCalledTimes(1);
  });
});
