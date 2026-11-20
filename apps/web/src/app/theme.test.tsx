import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './theme';

let api: ReturnType<typeof useTheme>;
function Probe() {
  api = useTheme();
  return null;
}

describe('ThemeProvider', () => {
  it('usa o claro por padrão, com a cor do navegador do fundo claro (sub-projeto 16, L1)', () => {
    localStorage.removeItem('fincontrol-theme');
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(meta.content).toBe('#F5F6F0');
    meta.remove();
  });

  it('quem escolheu o escuro continua no escuro', () => {
    localStorage.setItem('fincontrol-theme', 'dark');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(document.documentElement.dataset.theme).toBe('dark');
    localStorage.removeItem('fincontrol-theme');
  });

  it('aplica e persiste o tema escolhido', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => api.setTheme('light'));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('fincontrol-theme')).toBe('light');
  });

  it('resolve "system" pelo prefers-color-scheme', () => {
    const spy = vi.spyOn(window, 'matchMedia').mockImplementation(
      (q: string) => ({ matches: q.includes('dark'), addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList,
    );
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => api.setTheme('system'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    spy.mockRestore();
  });
});
