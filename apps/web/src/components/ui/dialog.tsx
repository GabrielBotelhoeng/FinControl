import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
};

/**
 * Diálogo centralizado no computador e, no celular, uma folha que sobe de baixo (sub-projeto 16, L7): alça no topo,
 * cantos de 28 px, até 92% da altura e rolagem própria. A animação some com prefers-reduced-motion (index.css).
 */
export function Dialog({ open, onOpenChange, title, description, children }: Props) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_200ms_ease-out]" />
        <RadixDialog.Content
          className={
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-y-auto rounded-t-[var(--radius-card)] border-t border-border bg-surface px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2 shadow-bar ' +
            'data-[state=open]:animate-[sheet-up_260ms_cubic-bezier(0.32,0.72,0,1)] ' +
            'sm:inset-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[90dvh] sm:w-[min(560px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-panel)] sm:border sm:p-7 sm:shadow-panel sm:data-[state=open]:animate-[fade-in_160ms_ease-out]'
          }
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <span aria-hidden className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-border sm:hidden" />
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <RadixDialog.Title className="font-display text-2xl font-semibold tracking-tight">{title}</RadixDialog.Title>
              {description && <RadixDialog.Description className="mt-1 text-sm text-muted">{description}</RadixDialog.Description>}
            </div>
            <RadixDialog.Close aria-label="Fechar" className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-text">
              <X className="h-5 w-5" strokeWidth={1.75} />
            </RadixDialog.Close>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
