import type { ThemePreference } from '@fincontrol/shared';
import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { toast } from 'sonner';
import { useTheme } from '../../app/theme';
import { Button } from '../../components/ui/button';
import { Field, Input } from '../../components/ui/field';
import { PageHeader } from '../../components/ui/page-header';
import { Panel } from '../../components/ui/panel';
import { Segmented } from '../../components/ui/segmented';
import { ErrorState, Skeleton } from '../../components/ui/states';
import { useAuth } from '../auth/auth-context';
import { useProfile, useUpdateProfile } from './api';
import { NotificationSettings } from './notification-settings';
import { DeleteAccountDialog } from './delete-account-dialog';

function NameForm({ initial }: { initial: string }) {
  const update = useUpdateProfile();
  const [name, setName] = useState(initial);
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        update.mutate({ name: name.trim() }, { onSuccess: () => toast.success('Nome atualizado.'), onError: (err) => toast.error(err.message) });
      }}
    >
      <Field label="Seu nome" className="flex-1">
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </Field>
      <Button type="submit" variant="secondary" loading={update.isPending} disabled={name.trim() === initial}>
        Salvar nome
      </Button>
    </form>
  );
}

export default function ProfilePage() {
  const profile = useProfile();
  const update = useUpdateProfile();
  const { theme, setTheme } = useTheme();
  const { signOut, isDemo } = useAuth();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  function changeTheme(t: ThemePreference) {
    setTheme(t);
    update.mutate({ theme: t });
  }

  return (
    <>
      <PageHeader light="Seu" bold="perfil" description={profile.data?.email ?? (isDemo ? 'Você está usando a conta demo.' : undefined)} />
      {profile.isPending && <Skeleton className="h-48 rounded-[var(--radius-panel)]" />}
      {profile.isError && <ErrorState message={profile.error.message} onRetry={() => profile.refetch()} />}
      {profile.data && (
        <div className="grid max-w-2xl gap-6">
          <Panel className="grid gap-6 p-6">
            <NameForm initial={profile.data.name} />
            <div className="grid gap-2">
              <span className="text-sm font-medium">Aparência</span>
              <Segmented
                label="Aparência"
                value={theme}
                onChange={changeTheme}
                options={[
                  { value: 'dark', label: 'Escuro' },
                  { value: 'light', label: 'Claro' },
                  { value: 'system', label: 'Sistema' },
                ]}
              />
            </div>
          </Panel>
          <NotificationSettings prefs={profile.data.notificationPrefs} />
          <Panel className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <h2 className="font-semibold">Categorias</h2>
              <p className="text-sm text-muted">Crie, renomeie ou exclua as categorias de receitas e despesas.</p>
            </div>
            <Link to="/categorias" className="text-sm font-medium text-primary hover:underline">
              Gerenciar categorias
            </Link>
          </Panel>
          <Panel className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <h2 className="font-semibold">Dívidas</h2>
              <p className="text-sm text-muted">Dívidas com lojas, pessoas e contas atrasadas: negociações, acordos e pagamentos.</p>
            </div>
            <Link to="/dividas" className="text-sm font-medium text-primary hover:underline">
              Ver dívidas
            </Link>
          </Panel>
          <Panel className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <h2 className="font-semibold">Calendário e resumo do mês</h2>
              <p className="text-sm text-muted">O que vence em cada dia e o que mudou no mês em poucas frases.</p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <Link to="/calendario" className="text-sm font-medium text-primary hover:underline">
                Ver calendário
              </Link>
              <Link to="/resumo" className="text-sm font-medium text-primary hover:underline">
                Ver resumo do mês
              </Link>
            </div>
          </Panel>
          <Panel className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <h2 className="font-semibold">Relatórios</h2>
              <p className="text-sm text-muted">Resumo do período, evolução das dívidas e exportação em PDF e CSV.</p>
            </div>
            <Link to="/relatorios" className="text-sm font-medium text-primary hover:underline">
              Ver relatórios
            </Link>
          </Panel>
          <Panel className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <h2 className="font-semibold">Assistente</h2>
              <p className="text-sm text-muted">Pergunte sobre seus gastos, orçamento, metas e dívidas em português simples.</p>
            </div>
            <Link to="/assistente" className="text-sm font-medium text-primary hover:underline">
              Abrir o assistente
            </Link>
          </Panel>
          <Panel className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <h2 className="font-semibold">Sair</h2>
              <p className="text-sm text-muted">Encerra a sessão neste aparelho.</p>
            </div>
            <Button
              variant="secondary"
              onClick={async () => {
                await signOut();
                navigate('/entrar', { replace: true });
              }}
            >
              <LogOut aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Sair
            </Button>
          </Panel>
          <Panel className="flex flex-wrap items-center justify-between gap-4 border-expense/30 p-6">
            <div>
              <h2 className="font-semibold text-expense">Excluir minha conta</h2>
              <p className="max-w-[48ch] text-sm text-muted">Apaga todos os seus dados do FinControl, como prevê a LGPD.</p>
            </div>
            <Button variant="danger" onClick={() => setDeleting(true)}>
              Excluir minha conta
            </Button>
          </Panel>
        </div>
      )}
      {deleting && <DeleteAccountDialog onClose={() => setDeleting(false)} />}
    </>
  );
}
