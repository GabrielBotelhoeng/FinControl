import { createContext, useContext, type ReactNode } from 'react';
import { useStartDemo } from '../auth/use-start-demo';

type SiteDemo = ReturnType<typeof useStartDemo>;

const SiteDemoContext = createContext<SiteDemo | null>(null);

/** Uma demo só para a página inteira: todos os botões "Experimentar" dividem a mesma trava e o mesmo estado. */
export function SiteDemoProvider({ children }: { children: ReactNode }) {
  const demo = useStartDemo();
  return <SiteDemoContext.Provider value={demo}>{children}</SiteDemoContext.Provider>;
}

export function useSiteDemo(): SiteDemo {
  const ctx = useContext(SiteDemoContext);
  if (!ctx) throw new Error('useSiteDemo precisa estar dentro de SiteDemoProvider');
  return ctx;
}
