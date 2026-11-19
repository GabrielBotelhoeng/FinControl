import type { OnboardingDTO } from '@fincontrol/shared';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, Rocket } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { Panel } from '../../components/ui/panel';
import { useApi } from '../../lib/api-context';
import { useAuth } from '../auth/auth-context';

const STORAGE_KEY = 'fincontrol:primeiros-passos-ocultos';

type Step = { key: keyof OnboardingDTO; title: string; detail: string; actions: { to: string; label: string }[] };

/** G1 e G4: os quatro passos, cada um com o caminho direto até o formulário. */
const STEPS: Step[] = [
  {
    key: 'account', title: 'Cadastre uma conta', detail: 'Corrente, poupança, carteira ou cartão, com o saldo de hoje.',
    actions: [{ to: '/contas?novo=1', label: 'Cadastrar conta' }],
  },
  {
    key: 'transaction', title: 'Faça o primeiro lançamento', detail: 'Uma receita ou uma despesa, ou o extrato do banco de uma vez.',
    actions: [{ to: '/lancamentos?novo=1', label: 'Lançar agora' }, { to: '/importar', label: 'Importar extrato' }],
  },
  {
    key: 'budget', title: 'Defina um limite no orçamento', detail: 'Quanto você quer gastar por mês numa categoria, como mercado ou lazer.',
    actions: [{ to: '/planejamento', label: 'Definir limite' }],
  },
  {
    key: 'goal', title: 'Crie uma meta', detail: 'Uma viagem, a reserva de emergência ou outro objetivo com prazo.',
    actions: [{ to: '/planejamento?aba=metas', label: 'Criar meta' }],
  },
];

// G3: ocultar é só uma conveniência deste navegador; sem armazenamento, o quadro volta na próxima visita.
function readHidden(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeHidden(key: string) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // Sem armazenamento, o quadro some só até recarregar a página.
  }
}

/** Primeiros passos (sub-projeto 12): só para contas reais, até os quatro passos estarem feitos ou a pessoa ocultar. */
export function OnboardingCard() {
  const api = useApi();
  const { user } = useAuth();
  const storageKey = `${STORAGE_KEY}:${user?.id ?? 'sem-sessao'}`;
  const [hiddenNow, setHiddenNow] = useState(false);
  const hidden = hiddenNow || (user !== null && readHidden(storageKey));
  const enabled = user !== null && !user.isAnonymous && !hidden;
  const onboarding = useQuery({ queryKey: ['onboarding'], queryFn: () => api.get<OnboardingDTO>('/onboarding'), enabled });

  // G6: sem os passos (carregando ou com erro, mesmo com dados anteriores guardados), o painel segue sem o quadro.
  if (!enabled || !onboarding.data || onboarding.isError) return null;
  const data = onboarding.data;
  const done = STEPS.filter((s) => data[s.key]).length;
  if (done === STEPS.length) return null;
  const pct = Math.round((done / STEPS.length) * 100);

  return (
    <Panel role="region" aria-label="Primeiros passos" className="mb-8 grid gap-5 p-5 sm:p-6">
      {/* Sem quebra: a 360 px, "Ocultar" fica no canto, ao lado do título, e só a descrição quebra a linha. */}
      <div className="flex items-start justify-between gap-3">
        <div className="grid min-w-0 flex-1 gap-1">
          <h2 className="inline-flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
            <Rocket aria-hidden className="h-5 w-5 text-primary" strokeWidth={1.75} />
            Primeiros passos
          </h2>
          <p className="text-sm text-muted">Quatro passos para o FinControl mostrar o seu mês de verdade.</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => {
            writeHidden(storageKey);
            setHiddenNow(true);
          }}
        >
          Ocultar
        </Button>
      </div>

      <div className="grid gap-2">
        <div className="flex justify-between gap-3 text-sm">
          <span className="font-medium">{`${done} de ${STEPS.length}`}</span>
          <span className="tabular text-muted">{`${pct}%`}</span>
        </div>
        <div
          role="progressbar"
          aria-label="Progresso dos primeiros passos"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="h-2 overflow-hidden rounded-full bg-surface-2"
        >
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ol className="grid gap-4 sm:grid-cols-2">
        {STEPS.map((s) => {
          const ok = data[s.key];
          return (
            <li key={s.key} aria-label={`${s.title}: ${ok ? 'feito' : 'a fazer'}`} className="flex min-w-0 items-start gap-3">
              {ok ? (
                <CheckCircle2 aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-income" strokeWidth={2} />
              ) : (
                <Circle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-muted" strokeWidth={1.75} />
              )}
              <div className="grid min-w-0 gap-1">
                {/* G5: feito aparece riscado de leve e com "Feito" para leitor de tela, não só pela cor ou pelo ícone. */}
                <p className={ok ? 'font-medium text-muted line-through decoration-1' : 'font-medium'}>
                  {s.title}
                  {ok && <span className="sr-only"> (Feito)</span>}
                </p>
                {!ok && <p className="text-sm text-muted">{s.detail}</p>}
                {!ok && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {s.actions.map((a) => (
                      <Link key={a.to} to={a.to} className="text-sm font-medium text-primary hover:underline">
                        {a.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
