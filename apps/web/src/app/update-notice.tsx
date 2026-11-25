import { RefreshCw, X } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { dismissUpdate, onUpdateAvailable } from '../lib/pwa-update';

export const UPDATE_TOAST_ID = 'nova-versao';

const reloadPage = () => window.location.reload();

/**
 * O aviso de versão nova (sub-projeto 19, A2 e A6), no `Toaster` do app: discreto, sem prazo para sumir e sem recarregar
 * sozinho (um formulário aberto não se perde). `role="status"` é lido sem interromper; nada aqui puxa o foco (o cursor
 * continua no campo), e os botões entram na ordem do teclado pelo atalho do sonner (Alt+T). O movimento do sonner já
 * some com `prefers-reduced-motion`. Atualizar só recarrega: a sessão e os dados ficam (A5).
 */
export function UpdateToast({ id, reload = reloadPage }: { id: string | number; reload?: () => void }) {
  return (
    <div
      role="status"
      className="flex w-[min(24rem,calc(100vw-2rem))] items-center gap-3 rounded-[20px] border border-border bg-surface py-3 pl-4 pr-2 font-sans text-text shadow-panel"
    >
      <RefreshCw aria-hidden className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Nova versão disponível</p>
        <p className="text-xs text-muted">Atualize quando terminar o que está fazendo.</p>
      </div>
      <Button size="sm" onClick={reload}>
        Atualizar
      </Button>
      <button
        type="button"
        aria-label="Fechar aviso"
        onClick={() => {
          dismissUpdate();
          toast.dismiss(id);
        }}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text"
      >
        <X aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}

/** Mostra o aviso quando o observador do main.tsx (lib/pwa-update.ts) vê uma versão nova; um aviso só, mesmo com vários sinais. */
export function UpdateNotice({ reload }: { reload?: () => void }) {
  useEffect(
    () =>
      onUpdateAvailable(() => {
        // Fechar (no X ou arrastando) consome o aviso até a próxima versão nova: remontar o app não o traz de volta.
        toast.custom((id) => <UpdateToast id={id} reload={reload} />, { id: UPDATE_TOAST_ID, duration: Infinity, onDismiss: dismissUpdate });
      }),
    [reload],
  );
  return null;
}
