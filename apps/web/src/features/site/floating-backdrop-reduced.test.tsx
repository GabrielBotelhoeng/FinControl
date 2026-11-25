import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { BACKDROPS, FloatingBackdrop } from './floating-backdrop';

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
  it('ficam parados: nenhuma flutuação e nenhum paralaxe', () => {
    const { container } = render(<FloatingBackdrop items={BACKDROPS.mobileApp} />);
    expect(container.querySelectorAll('[data-float]')).toHaveLength(BACKDROPS.mobileApp.length);
    expect(container.querySelectorAll('.site-drift')).toHaveLength(0);
    for (const layer of container.querySelectorAll<HTMLElement>('[data-backdrop] > div')) {
      expect(layer.style.transform === '' || layer.style.transform === 'none').toBe(true);
    }
  });
});
