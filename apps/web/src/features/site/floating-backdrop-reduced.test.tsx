import { render, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { BACKDROPS, FloatingBackdrop, type FloatItem } from './floating-backdrop';

/** Os elementos entram no quadro seguinte à montagem (numa transição): espera eles aparecerem. */
async function renderBackdrop(items: readonly FloatItem[]) {
  const view = render(<FloatingBackdrop items={items} />);
  await waitFor(() => expect(view.container.querySelectorAll('[data-float]')).toHaveLength(items.length));
  return view;
}

// Arquivo à parte: o Motion lê o `prefers-reduced-motion` uma vez por módulo.
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

describe('elementos flutuando com prefers-reduced-motion', () => {
  it('ficam parados: nenhuma flutuação e nenhum paralaxe', async () => {
    const { container } = await renderBackdrop(BACKDROPS.mobileApp);
    expect(container.querySelectorAll('[data-float]')).toHaveLength(BACKDROPS.mobileApp.length);
    expect(container.querySelectorAll('.site-drift')).toHaveLength(0);
    for (const layer of container.querySelectorAll<HTMLElement>('[data-backdrop] > div')) {
      expect(layer.style.transform === '' || layer.style.transform === 'none').toBe(true);
    }
  });
});
