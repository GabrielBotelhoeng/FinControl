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

/** Diálogo centralizado no desktop e em tela cheia no celular (spec 8.3). */
export function Dialog({ open, onOpenChange, title, description, children }: Props) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]" />
        <RadixDialog.Content
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-surface p-5 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[90dvh] sm:w-[min(560px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-panel)] sm:border sm:border-border sm:p-7 sm:shadow-panel"
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
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
