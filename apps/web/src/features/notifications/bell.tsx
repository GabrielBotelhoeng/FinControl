import { Bell } from 'lucide-react';
import { Link } from 'react-router';
import { useNotifications } from './api';

/** N9: sino no topo de todas as telas, com os não lidos (até "9+"). */
export function NotificationBell() {
  const { data } = useNotifications();
  const unread = data?.unreadCount ?? 0;
  const label = unread === 0 ? 'Notificações' : `Notificações, ${unread} ${unread === 1 ? 'não lida' : 'não lidas'}`;
  return (
    <Link
      to="/notificacoes"
      aria-label={label}
      className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors hover:text-text"
    >
      <Bell aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
      {unread > 0 && (
        <span
          aria-hidden
          className="tabular absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-expense px-1 text-[11px] font-bold leading-none text-white"
        >
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}
