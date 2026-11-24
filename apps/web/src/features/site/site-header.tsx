import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { LogoMark } from '../../components/ui/logo';
import { cn } from '../../lib/cn';
import { useSiteDemo } from './demo-context';

const LINKS = [
  { href: '#recursos', label: 'Recursos' },
  { href: '#planos', label: 'Planos' },
  { href: '#perguntas', label: 'Perguntas' },
];

/** Cabeçalho fixo: transparente no topo; com fundo e sombra depois de 8 px de rolagem. */
export function SiteHeader() {
  const demo = useSiteDemo();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 border-b transition-[background-color,box-shadow,border-color] duration-300',
        scrolled ? 'border-border bg-background/90 shadow-panel backdrop-blur-md' : 'border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:h-[72px] md:px-10">
        <a href="#topo" className="inline-flex items-center gap-2 rounded-full" aria-label="FinControl, voltar ao topo">
          <LogoMark className="h-9 w-9" />
          <span aria-hidden className="font-display text-xl font-bold leading-none tracking-tight max-[379px]:hidden">
            Fin<span className="text-primary">Control</span>
          </span>
        </a>
        <nav aria-label="Seções do site" className="ml-8 hidden md:block">
          <ul className="flex items-center gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="rounded-full px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1.5 md:gap-2">
          <Link to="/entrar" className="rounded-full px-3 py-2 text-sm font-semibold text-text transition-colors hover:bg-surface-2 md:px-4">
            Entrar
          </Link>
          <Button size="sm" onClick={() => void demo.start()} loading={demo.pending}>
            {!demo.pending && <Sparkles aria-hidden className="h-4 w-4 max-[379px]:hidden" strokeWidth={1.75} />}
            Experimentar
          </Button>
        </div>
      </div>
    </header>
  );
}
