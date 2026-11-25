import { render, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BACKDROPS, FloatingBackdrop, type FloatItem } from './floating-backdrop';

/** Um IntersectionObserver que avisa na hora que a seção está na tela (o do jsdom nunca avisa). */
class VisibleObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
// O setup define o observador sem `configurable`: troca por atribuição e volta ao original depois de cada teste.
const original = window.IntersectionObserver;
const useObserver = (impl: unknown) => {
  window.IntersectionObserver = impl as typeof IntersectionObserver;
};
beforeEach(() => useObserver(VisibleObserver));
afterEach(() => useObserver(original));

/** Os elementos entram quando a seção chega perto da tela (numa transição): espera eles aparecerem. */
async function renderBackdrop(items: readonly FloatItem[]) {
  const view = render(<FloatingBackdrop items={items} />);
  await waitFor(() => expect(view.container.querySelectorAll('[data-float]')).toHaveLength(items.length));
  return view;
}

describe('elementos flutuando no fundo (sub-projeto 20)', () => {
  it('ficam escondidos do leitor de tela, não recebem toque e ficam atrás do conteúdo', async () => {
    const { container } = await renderBackdrop(BACKDROPS.hero);
    const layer = container.querySelector('[data-backdrop]')!;
    expect(layer).toHaveAttribute('aria-hidden', 'true');
    expect(layer).toHaveClass('pointer-events-none', '-z-10', 'absolute', 'overflow-hidden');
    expect(layer.querySelectorAll('[data-float]')).toHaveLength(BACKDROPS.hero.length);
  });

  it('flutuam em CSS (site-drift), com ciclos de 6 a 14 s', async () => {
    const { container } = await renderBackdrop(BACKDROPS.features);
    const drifting = container.querySelectorAll<HTMLElement>('.site-drift');
    expect(drifting).toHaveLength(BACKDROPS.features.length);
    for (const el of drifting) {
      const seconds = parseFloat(el.style.animationDuration);
      expect(seconds).toBeGreaterThanOrEqual(6);
      expect(seconds).toBeLessThanOrEqual(14);
    }
  });

  it('até 8 por área no computador e até 4 no celular; o resto some abaixo de 768 px', async () => {
    for (const [area, items] of Object.entries(BACKDROPS)) {
      expect(items.length, area).toBeLessThanOrEqual(8);
      expect(items.filter((i) => i.phone).length, area).toBeLessThanOrEqual(4);
      const { container, unmount } = await renderBackdrop(items);
      const onPhone = [...container.querySelectorAll('[data-float]')].filter((el) => !el.classList.contains('max-md:hidden'));
      expect(onPhone.length, area).toBe(items.filter((i) => i.phone).length);
      unmount();
    }
  });

  it('o HTML estático leva só a camada vazia: os elementos entram depois, sem pesar no primeiro quadro', () => {
    const html = renderToString(<FloatingBackdrop items={BACKDROPS.hero} />);
    expect(html).toContain('data-backdrop');
    expect(html).not.toContain('data-float');
  });

  it('a coluna de avisos rola só com transform, fica só no computador e tem a lista duplicada escondida', async () => {
    const { container } = await renderBackdrop(BACKDROPS.howItWorks);
    const ticker = container.querySelector('[data-float="ticker"]')!;
    expect(ticker).toHaveClass('max-md:hidden');
    const lists = ticker.querySelectorAll('ul');
    expect(lists).toHaveLength(2);
    expect(ticker.querySelector('.site-ticker')).not.toBeNull();
  });

  it('abaixo da dobra (a seção ainda longe da tela), os elementos não montam', async () => {
    useObserver(
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
    );
    const { container } = render(<FloatingBackdrop items={BACKDROPS.features} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(container.querySelector('[data-backdrop]')).not.toBeNull();
    expect(container.querySelectorAll('[data-float]')).toHaveLength(0);
  });

  it('a moeda não tem texto no DOM (o "R$" é desenho do CSS)', async () => {
    const { container } = await renderBackdrop(BACKDROPS.hero);
    for (const coin of container.querySelectorAll('[data-float="coin"]')) expect(coin.textContent).toBe('');
  });

  it('os blobs passam atrás de texto com opacidade de no máximo 0,25 (0,45 os que nunca ficam atrás de texto)', async () => {
    for (const items of Object.values(BACKDROPS)) {
      for (const item of items) {
        if (item.kind !== 'blob') continue;
        const alpha = parseInt(item.color.slice(7, 9), 16) / 255;
        expect(alpha).toBeLessThanOrEqual('clear' in item && item.clear ? 0.45 : 0.25);
      }
    }
  });
});
