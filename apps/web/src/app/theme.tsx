import type { ThemePreference } from '@fincontrol/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'fincontrol-theme';
// Sub-projeto 16 (L1): o claro é o padrão. Quem escolheu "Escuro" ou "Sistema" no Perfil continua com a escolha.
// O script no index.html aplica o mesmo tema antes do React, para não piscar o tema errado ao abrir.
const DEFAULT_THEME: ThemePreference = 'light';
/** Cor da barra do navegador e do app instalado: o fundo de cada tema (styles/index.css). */
export const THEME_COLOR = { light: '#F5F6F0', dark: '#0B0D09' } as const;

type ThemeContextValue = { theme: ThemePreference; setTheme: (t: ThemePreference) => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStored(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' || value === 'system' ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function resolve(theme: ThemePreference): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(readStored);

  useEffect(() => {
    const apply = () => {
      const resolved = resolve(theme);
      document.documentElement.dataset.theme = resolved;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[resolved]);
    };
    apply();
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  const setTheme = useCallback((t: ThemePreference) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // armazenamento indisponível (aba privada): o tema vale só para esta sessão
    }
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme precisa estar dentro de ThemeProvider');
  return ctx;
}
