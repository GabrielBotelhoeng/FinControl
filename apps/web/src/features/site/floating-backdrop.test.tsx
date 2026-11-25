import { render, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BACKDROPS, FloatingBackdrop, type FloatItem } from './floating-backdrop';

/** Os elementos entram no quadro seguinte à montagem (numa transição): espera eles aparecerem. */
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

  it('a moeda não tem texto no DOM (o "R$" é desenho do CSS)', async () => {
    const { container } = await renderBackdrop(BACKDROPS.hero);
    for (const coin of container.querySelectorAll('[data-float="coin"]')) expect(coin.textContent).toBe('');
  });

  it('os blobs passam atrás de texto com opacidade de no máximo 0,25', async () => {
    for (const items of Object.values(BACKDROPS)) {
      for (const item of items) {
        if (item.kind !== 'blob') continue;
        const alpha = parseInt(item.color.slice(7, 9), 16) / 255;
        expect(alpha).toBeLessThanOrEqual(0.25);
      }
    }
  });
});
