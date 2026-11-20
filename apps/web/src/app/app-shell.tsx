import { LayoutGrid, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Dialog } from '../components/ui/dialog';
import { IconTile } from '../components/ui/icon-tile';
import { Logo } from '../components/ui/logo';
import { useAuth } from '../features/auth/auth-context';
import { cn } from '../lib/cn';
import { NotificationBell } from '../features/notifications/bell';
import { TransactionForm } from '../features/transactions/transaction-form';
import { BAR_ITEMS, isInMore, MORE_ITEMS, NAV_ITEMS } from './nav';

function DemoBadge() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-3 rounded-full border border-primary/30 bg-primary-soft py-1.5 pl-4 pr-1.5 text-sm">
      <Sparkles aria-hidden className="h-4 w-4 text-primary" strokeWidth={1.75} />
      <span className="mr-auto whitespace-nowrap font-medium">Modo demo</span>
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

const tabClass = (active: boolean) =>
  cn(
    'flex min-w-0 flex-col items-center gap-0.5 rounded-[18px] px-1 py-2 text-[10.5px] font-semibold tracking-[-0.01em] transition-colors',
    active ? 'bg-primary-soft text-text' : 'text-muted hover:text-text',
  );

/** Folha "Mais" do celular (sub-projeto 16, L6): as telas fora da barra, cada uma num quadrado colorido. */
function MoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Mais">
      <nav aria-label="Mais telas">
        <ul className="grid grid-cols-3 gap-2.5">
          {MORE_ITEMS.map(({ to, label, icon, tone }) => (
            <li key={to}>
              <Link
                to={to}
                onClick={() => onOpenChange(false)}
                className="flex h-full flex-col items-center gap-2 rounded-[20px] bg-surface-2 px-2 pb-3 pt-3.5 text-center text-xs font-semibold leading-tight transition-colors hover:bg-primary-soft"
              >
                <IconTile icon={icon} color={tone} size="lg" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Dialog>
  );
}

export function AppShell() {
  const { isDemo } = useAuth();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState(false);
  // Trocar de tela (inclusive pelo voltar e avançar do navegador) fecha a folha "Mais" e o formulário do "+", como
  // fechavam os diálogos de cada página. O ajuste é feito durante a renderização, guardando a última tela, para não
  // reabrir a folha ao voltar para a tela onde ela foi aberta (CodeRabbit).
  const [shownPath, setShownPath] = useState(pathname);
  if (pathname !== shownPath) {
    setShownPath(pathname);
    setMoreOpen(false);
    setNewTransaction(false);
  }

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-10 overflow-y-auto border-r border-border px-5 py-7 md:flex">
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
                  isActive ? 'bg-brand font-semibold text-brand-fg' : 'text-muted hover:bg-surface-2 hover:text-text',
                )
              }
            >
              <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col overflow-x-clip">
        {/* No celular, o selo da demo desce para uma segunda linha: logo, selo e sino não cabem lado a lado a 360 px. */}
        <header className="flex flex-wrap items-center gap-3 px-5 pt-5 md:px-10 md:pt-7">
          <span className="md:hidden">
            <Logo />
          </span>
          {isDemo && (
            <div className="order-last w-full sm:order-none sm:ml-auto sm:w-auto">
              <DemoBadge />
            </div>
          )}
          <div className={cn('ml-auto', isDemo && 'sm:ml-0')}>
            <NotificationBell />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-32 pt-6 md:px-10 md:pb-12">
          <Outlet />
        </main>
      </div>

      {/* Barra flutuante do celular (L6): Painel, Lançamentos, "+", Contas e Mais. */}
      <nav aria-label="Principal (celular)" className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 md:hidden">
        {/* "Lançamentos" é o rótulo mais longo: a coluna dele é mais larga para caber a 360 px. */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1 rounded-[26px] border border-border bg-surface/95 p-1.5 shadow-bar backdrop-blur">
          {BAR_ITEMS.slice(0, 2).map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => tabClass(isActive)}>
              <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
          <button
            type="button"
            aria-label="Novo lançamento"
            onClick={() => setNewTransaction(true)}
            className="mx-1 grid h-12 w-12 place-items-center rounded-full bg-brand text-brand-fg shadow-[0_8px_20px_-8px_rgba(63,98,18,0.65)] transition-transform active:scale-95"
          >
            <Plus aria-hidden className="h-6 w-6" strokeWidth={2.25} />
          </button>
          {BAR_ITEMS.slice(2).map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => tabClass(isActive)}>
              <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-current={isInMore(pathname) ? 'true' : undefined}
            onClick={() => setMoreOpen(true)}
            className={tabClass(isInMore(pathname))}
          >
            <LayoutGrid aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            Mais
          </button>
        </div>
      </nav>

      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
      {newTransaction && <TransactionForm open onOpenChange={setNewTransaction} />}
    </div>
  );
}
