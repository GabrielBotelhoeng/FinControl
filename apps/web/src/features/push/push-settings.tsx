import type { PushConfigDTO, PushTestDTO } from '@fincontrol/shared';
import { useQuery } from '@tanstack/react-query';
import { BellRing, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { useApi } from '../../lib/api-context';
import { browserPushClient, type PushClient } from './push-client';

type State = 'loading' | 'off' | 'on';

/**
 * Avisos no celular e no navegador (sub-projeto 5, Parte B, W4): a pessoa ativa com um clique (é quando o
 * navegador pede a permissão), pode mandar um aviso de teste e desligar neste aparelho.
 */
export function PushSettings({ isDemo, client = browserPushClient }: { isDemo: boolean; client?: PushClient }) {
  const api = useApi();
  const config = useQuery({ queryKey: ['push', 'config'], queryFn: () => api.get<PushConfigDTO>('/push/config'), staleTime: Infinity });
  const support = client.support();
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);
  const usable = config.data?.enabled === true && !isDemo && support === 'supported';

  useEffect(() => {
    if (!usable) return;
    let alive = true;
    // A assinatura do navegador só conta como "ligada" depois de confirmada no servidor: ele pode tê-la apagado
    // (expirada) ou ela pode ser de quem usou o aparelho antes. O POST é idempotente e passa a assinatura para cá.
    client
      .current()
      .then(async (sub) => {
        if (!sub || client.permission() !== 'granted') return 'off' as const;
        await api.post('/push/subscriptions', sub);
        return 'on' as const;
      })
      .then((next) => alive && setState(next))
      .catch(() => alive && setState('off'));
    return () => {
      alive = false;
    };
  }, [usable, client, api]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível concluir.');
    } finally {
      setBusy(false);
    }
  };

  const enable = () =>
    run(async () => {
      const sub = await client.subscribe(config.data!.publicKey!);
      await api.post('/push/subscriptions', sub);
      setState('on');
      toast.success('Avisos ligados neste aparelho.');
    });
  const disable = () =>
    run(async () => {
      const endpoint = await client.unsubscribe();
      // O navegador já não recebe nada: a tela mostra desligado mesmo se a limpeza no servidor falhar (o próximo
      // envio recebe 404/410 e apaga a assinatura de qualquer jeito).
      setState('off');
      toast.success('Avisos desligados neste aparelho.');
      if (endpoint) await api.post('/push/unsubscribe', { endpoint }).catch(() => undefined);
    });
  const test = () =>
    run(async () => {
      const { sent } = await api.post<PushTestDTO>('/push/test');
      if (sent > 0) toast.success('Aviso de teste enviado. Ele chega em alguns segundos.');
      else toast.error('Nenhum aparelho recebeu. Desligue e ligue de novo.');
    });

  let message: string | null = null;
  if (config.data && !config.data.enabled) message = 'Os avisos no celular ainda não estão disponíveis.';
  else if (isDemo) message = 'Disponível numa conta de verdade: a conta demo é apagada em 7 dias.';
  else if (support === 'ios-needs-install') message = 'No iPhone, instale o app na tela inicial (Compartilhar → Adicionar à Tela de Início) e ative por lá.';
  else if (support === 'unsupported') message = 'Este navegador não recebe avisos. Use o Chrome, o Edge, o Firefox ou o Safari atualizado.';
  else if (client.permission() === 'denied') message = 'Os avisos estão bloqueados neste navegador. Libere nas configurações do site e volte aqui.';

  return (
    <div role="group" aria-label="Avisos no celular e no navegador" className="grid gap-3 border-t border-border pt-5">
      <div className="flex items-start gap-3">
        <Smartphone aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={1.75} />
        <div className="grid gap-0.5">
          <span className="text-sm font-medium">Avisos no celular e no navegador</span>
          <span className="text-xs text-muted">Todo dia às 8h, um aviso com o que é novo na central. Só neste aparelho.</span>
        </div>
      </div>
      {config.isPending ? null : config.isError ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">Não foi possível verificar os avisos no celular.</p>
          <Button size="sm" variant="secondary" onClick={() => config.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : message ? (
        <p className="text-sm text-muted">{message}</p>
      ) : state === 'loading' ? null : state === 'on' ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 inline-flex items-center gap-1.5 text-sm font-medium text-income">
            <BellRing aria-hidden className="h-4 w-4" strokeWidth={2} />
            Ligado neste aparelho
          </span>
          <Button size="sm" variant="secondary" disabled={busy} onClick={test}>
            Enviar um aviso de teste
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={disable}>
            Desligar neste aparelho
          </Button>
        </div>
      ) : (
        <div>
          <Button size="sm" loading={busy} onClick={enable}>
            Receber no celular e no navegador
          </Button>
        </div>
      )}
    </div>
  );
}
