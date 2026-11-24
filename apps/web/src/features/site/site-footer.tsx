import { Link } from 'react-router';
import { Logo } from '../../components/ui/logo';

const LINKS = [
  { to: '/entrar', label: 'Entrar' },
  { to: '/privacidade', label: 'Privacidade' },
  { to: '/termos', label: 'Termos de Uso' },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 md:flex-row md:items-end md:justify-between md:px-10">
        <Logo markClassName="h-10 w-10" tagline />
        <nav aria-label="Links do rodapé">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-muted">
            {LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="hover:text-text">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-sm text-muted">© {new Date().getFullYear()} FinControl</p>
      </div>
    </footer>
  );
}
