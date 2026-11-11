import type { Scope } from '@fincontrol/shared';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';

type Props = { action: 'edit' | 'delete'; onChoose: (scope: Scope) => void; onCancel: () => void };

/** Lançamento recorrente: sempre perguntar o alcance antes de alterar ou excluir. */
export function ScopeDialog({ action, onChoose, onCancel }: Props) {
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onCancel()}
      title={action === 'edit' ? 'Aplicar a alteração em' : 'Excluir quais lançamentos?'}
      description="Este lançamento faz parte de uma recorrência. Os já pagos nunca são alterados."
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" size="lg" onClick={() => onChoose('single')}>
          Só esta
        </Button>
        <Button variant={action === 'delete' ? 'danger' : 'primary'} size="lg" onClick={() => onChoose('future')}>
          Esta e as próximas
        </Button>
      </div>
    </Dialog>
  );
}
