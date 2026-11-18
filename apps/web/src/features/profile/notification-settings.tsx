import type { BillDays, NotificationPrefs } from '@fincontrol/shared';
import { useEffect, useState } from 'react';
import { Panel } from '../../components/ui/panel';
import { Segmented } from '../../components/ui/segmented';
import { useAuth } from '../auth/auth-context';
import { PushSettings } from '../push/push-settings';
import { useUpdateNotificationPrefs } from './api';

const TYPES: { key: 'bills' | 'invoices' | 'budget' | 'goals'; label: string; hint: string }[] = [
  { key: 'bills', label: 'Contas', hint: 'Contas perto do vencimento e vencidas.' },
  { key: 'invoices', label: 'Faturas', hint: 'Faturas de cartão fechadas e vencidas.' },
  { key: 'budget', label: 'Orçamento', hint: 'Categorias perto do limite ou estouradas.' },
  { key: 'goals', label: 'Metas', hint: 'Metas que chegaram ao valor.' },
];

const DAYS: { value: `${BillDays}`; label: string }[] = [
  { value: '1', label: '1 dia' },
  { value: '3', label: '3 dias' },
  { value: '7', label: '7 dias' },
];

/** Preferências de notificação (sub-projeto 5, N7): o que avisar e com quanta antecedência. */
export function NotificationSettings({ prefs: saved }: { prefs: NotificationPrefs }) {
  const update = useUpdateNotificationPrefs();
  const { isDemo } = useAuth();
  // A caixa muda no próprio clique; sem salvamento pendente, volta a seguir o perfil (que a mutação corrige em erro).
  const [prefs, setPrefs] = useState(saved);
  useEffect(() => {
    if (!update.isPending) setPrefs(saved);
  }, [saved, update.isPending]);
  const save = (next: NotificationPrefs) => {
    setPrefs(next);
    update.mutate(next);
  };

  return (
    <Panel role="region" aria-label="Notificações" className="grid gap-5 p-6">
      <div>
        <h2 className="font-semibold">Notificações</h2>
        <p className="text-sm text-muted">Escolha o que aparece no sino.</p>
      </div>
      <ul className="grid gap-3">
        {TYPES.map((t) => (
          <li key={t.key}>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]"
                checked={prefs[t.key]}
                onChange={(e) => save({ ...prefs, [t.key]: e.target.checked })}
              />
              <span className="grid">
                <span className="text-sm font-medium">{t.label}</span>
                <span className="text-xs text-muted">{t.hint}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="grid gap-2">
        <span className="text-sm font-medium">Avisar das contas com antecedência de</span>
        <Segmented
          label="Antecedência das contas"
          value={`${prefs.billDays}` as `${BillDays}`}
          onChange={(v) => save({ ...prefs, billDays: Number(v) as BillDays })}
          options={DAYS}
        />
      </div>
      <PushSettings isDemo={isDemo} />
    </Panel>
  );
}
