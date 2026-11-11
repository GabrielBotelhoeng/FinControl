import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Field, Input } from '../../components/ui/field';
import { useAuth } from '../auth/auth-context';
import { useDeleteAccount } from './api';

const WORD = 'EXCLUIR';

export function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const remove = useDeleteAccount();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [typed, setTyped] = useState('');

  async function confirm() {
    try {
      await remove.mutateAsync();
      await signOut();
      toast.success('Sua conta e todos os seus dados foram excluídos.');
      navigate('/entrar', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir agora.');
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Excluir sua conta"
      description="Isso apaga para sempre suas contas, categorias, lançamentos e recorrências. Não dá para desfazer."
    >
      <div className="grid gap-5">
        <Field label={`Digite ${WORD} para confirmar`}>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" disabled={typed !== WORD} loading={remove.isPending} onClick={confirm}>
            Excluir definitivamente
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
