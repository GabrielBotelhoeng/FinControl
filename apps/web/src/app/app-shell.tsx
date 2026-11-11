import { Sparkles } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { useAuth } from '../features/auth/auth-context';
import { cn } from '../lib/cn';
import { NAV_ITEMS } from './nav';

function Logo() {
  return (
    <span className="font-display text-xl tracking-tight">
      <span className="font-extralight">Fin</span>
      <span className="font-extrabold">Control</span>
    </span>
  );
}

function DemoBadge() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-3 rounded-full border border-primary/40 bg-primary-soft py-1.5 pl-4 pr-1.5 text-sm">
      <Sparkles aria-hidden className="h-4 w-4 text-primary" strokeWidth={1.75} />
      <span className="font-medium">Modo demo</span>
      <Button
        size="sm"
        className="h-8"
        onClick={async () => {
          await signOut();
          navigate('/entrar?modo=cadastro');
        }}
      >
        Criar conta de verdade
      </Button>
    </div>
  );
}

export function AppShell() {
  const { isDemo } = useAuth();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-10 border-r border-border px-5 py-7 md:flex">
        <Logo />
        <nav aria-label="Principal" className="grid gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary-soft text-text' : 'text-muted hover:bg-surface-2 hover:text-text',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon aria-hidden className={cn('h-[18px] w-[18px]', isActive && 'text-primary')} strokeWidth={1.75} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-3 px-5 pt-5 md:px-10 md:pt-7">
          <span className="md:hidden">
            <Logo />
          </span>
          {isDemo && (
            <div className="ml-auto">
              <DemoBadge />
            </div>
          )}
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-28 pt-6 md:px-10 md:pb-12">
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="Principal (celular)"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', isActive ? 'text-primary' : 'text-muted')
            }
          >
            <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
