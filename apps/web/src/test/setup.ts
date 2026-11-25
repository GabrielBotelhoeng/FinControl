import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { resetDemoStartForTests } from '../features/auth/use-start-demo';

// O src/prerender.test.tsx roda no ambiente node (o caminho do build): lá não há window nem localStorage.
const hasDom = typeof window !== 'undefined';

afterEach(() => {
  cleanup();
  if (hasDom) localStorage.clear();
  // O início da demo guarda o estado fora do React (store de módulo): cada teste começa do zero.
  resetDemoStartForTests();
});

if (hasDom && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// O jsdom não tem IntersectionObserver; o site (Motion `whileInView`/`useInView`) só precisa que ele exista.
if (hasDom && !('IntersectionObserver' in window)) {
  class NoopIntersectionObserver {
    readonly root = null;
    readonly rootMargin = '0px';
    readonly thresholds = [0];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  Object.defineProperty(window, 'IntersectionObserver', { writable: true, value: NoopIntersectionObserver });
  Object.defineProperty(globalThis, 'IntersectionObserver', { writable: true, value: NoopIntersectionObserver });
}
