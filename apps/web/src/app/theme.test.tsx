import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './theme';

let api: ReturnType<typeof useTheme>;
function Probe() {
  api = useTheme();
  return null;
}

describe('ThemeProvider', () => {
  it('usa escuro por padrão', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('aplica e persiste o tema escolhido', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => api.setTheme('light'));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('fincontrol-theme')).toBe('light');
  });

  it('resolve "system" pelo prefers-color-scheme', () => {
    const spy = vi.spyOn(window, 'matchMedia').mockImplementation(
      (q: string) => ({ matches: q.includes('light'), addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList,
    );
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => api.setTheme('system'));
    expect(document.documentElement.dataset.theme).toBe('light');
    spy.mockRestore();
  });
});
