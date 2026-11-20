import { ASSISTANT_MAX_CHARS, type AssistantMessage } from '@fincontrol/shared';
import { Bot, RotateCcw, SendHorizontal, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { controlClass } from '../../components/ui/field';
import { PageHeader } from '../../components/ui/page-header';
import { Panel } from '../../components/ui/panel';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/ui/states';
import { cn } from '../../lib/cn';
import { useAuth } from '../auth/auth-context';
import { useAsk, useAssistantConfig, useConsent } from './api';
import { loadConversation, saveConversation } from './storage';

export const SUGGESTIONS = [
  'Quanto gastei este mês e com o quê?',
  'Onde estou gastando mais do que antes?',
  'Estou dentro do orçamento?',
  'Quanto gastei com delivery nos últimos 3 meses?',
  'Como estão minhas metas?',
  'Quanto devo no cartão e nos empréstimos?',
];

function ConsentPanel() {
  const consent = useConsent();
  return (
    <Panel className="grid max-w-2xl gap-4 p-6">
      <ShieldCheck aria-hidden className="h-6 w-6 text-primary" strokeWidth={1.75} />
      <h2 className="font-display text-xl font-semibold tracking-tight">Antes de começar</h2>
      <div className="grid gap-2 text-sm text-muted">
        <p>
          Para responder, o assistente usa a inteligência artificial da Anthropic. Vão para ela o seu primeiro nome, a lista das suas
          categorias, a sua pergunta, as mensagens desta conversa e os dados financeiros que o assistente consultar para responder, como
          lançamentos, saldos, orçamento e metas.
        </p>
        <p>
          A Anthropic não usa esses dados para treinar modelos e os guarda por até 30 dias, para segurança. O FinControl não guarda a
          conversa: ela some quando você fecha a aba.
        </p>
        <p>O assistente só consulta. Ele não cria, não altera e não apaga nada.</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button loading={consent.isPending} onClick={() => consent.mutate(true, { onError: (err) => toast.error(err.message) })}>
          Aceitar e começar
        </Button>
        <Link to="/privacidade" className="text-sm font-medium text-primary hover:underline">
          Política de privacidade
        </Link>
      </div>
    </Panel>
  );
}

function Bubble({ message }: { message: AssistantMessage }) {
  const mine = message.role === 'user';
  return (
    <li className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] whitespace-pre-wrap break-words rounded-[var(--radius-panel)] px-4 py-3 text-sm',
          mine ? 'bg-primary text-primary-fg' : 'border border-border bg-surface-2',
        )}
      >
        <span className="sr-only">{mine ? 'Você: ' : 'Assistente: '}</span>
        {message.content}
      </div>
    </li>
  );
}

function RevokeDialog({ open, onOpenChange, onRevoke }: { open: boolean; onOpenChange: (open: boolean) => void; onRevoke?: () => void }) {
  const consent = useConsent();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Retirar o consentimento"
      description="A conversa será apagada, e o assistente vai pedir o aceite de novo antes da próxima pergunta."
    >
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button
          variant="danger"
          loading={consent.isPending}
          onClick={() => {
            onRevoke?.();
            consent.mutate(false, { onError: (err) => toast.error(err.message) });
          }}
        >
          Retirar
        </Button>
      </div>
    </Dialog>
  );
}

function Chat({ userId }: { userId: string }) {
  const ask = useAsk();
  const [messages, setMessages] = useState<AssistantMessage[]>(() => loadConversation(userId));
  // Muda a cada "Nova conversa": uma resposta que chegue depois não ressuscita a conversa apagada.
  const generation = useRef(0);
  const [draft, setDraft] = useState('');
  const [revoking, setRevoking] = useState(false);
  const endRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    saveConversation(userId, messages);
    endRef.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' });
  }, [userId, messages, ask.isPending]);

  function send(text: string) {
    const question = text.trim();
    if (!question || ask.isPending) return;
    const next: AssistantMessage[] = [...messages, { role: 'user', content: question }];
    setMessages(next);
    setDraft('');
    const current = generation.current;
    ask.mutate(next, {
      onSuccess: ({ reply }) => {
        if (generation.current === current) setMessages([...next, { role: 'assistant', content: reply }]);
      },
      // A pergunta volta para a caixa: a conversa continua alternando e a pessoa tenta de novo.
      onError: (err) => {
        if (generation.current !== current) return;
        setMessages(messages);
        setDraft(question);
        toast.error(err.message);
      },
    });
  }

  function clear() {
    generation.current += 1;
    setMessages([]);
  }

  const last = messages.at(-1);
  return (
    <div className="grid max-w-3xl gap-4">
      {/* Uma região só para o leitor de tela: anuncia "pensando" e a última resposta, sem repetir a conversa. */}
      <div role="status" className="sr-only">
        {ask.isPending ? 'Pensando…' : last?.role === 'assistant' ? `Assistente: ${last.content}` : ''}
      </div>
      {messages.length === 0 ? (
        <Panel className="grid gap-4 p-6">
          <p className="text-sm text-muted">Pergunte sobre seus gastos, receitas, orçamento, metas ou dívidas. Algumas ideias:</p>
          <ul aria-label="Sugestões" className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-border px-4 py-2 text-left text-sm transition-colors hover:bg-surface-2"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      ) : (
        <Panel className="p-4 sm:p-6">
          <ul aria-label="Conversa" className="grid gap-3">
            {messages.map((m, i) => (
              <Bubble key={i} message={m} />
            ))}
            {ask.isPending && (
              <li className="flex items-center gap-2 text-sm text-muted" aria-hidden>
                <Bot aria-hidden className="h-4 w-4 animate-pulse" strokeWidth={1.75} />
                Pensando…
              </li>
            )}
            <li ref={endRef} aria-hidden />
          </ul>
        </Panel>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <label htmlFor="pergunta" className="sr-only">
          Sua pergunta
        </label>
        <textarea
          id="pergunta"
          rows={2}
          value={draft}
          maxLength={ASSISTANT_MAX_CHARS}
          placeholder="Ex.: quanto gastei com bebida em outubro?"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(draft);
            }
          }}
          className={cn(controlClass, 'h-auto min-h-11 flex-1 resize-none py-2.5')}
        />
        <Button type="submit" aria-label="Enviar" loading={ask.isPending} disabled={!draft.trim()}>
          <SendHorizontal aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </Button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <span>O assistente pode errar. Confira os números importantes nos relatórios.</span>
        <div className="flex gap-4">
          {messages.length > 0 && (
            <button type="button" className="inline-flex items-center gap-1 font-medium text-primary hover:underline" onClick={clear}>
              <RotateCcw aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Nova conversa
            </button>
          )}
          <button type="button" className="font-medium hover:underline" onClick={() => setRevoking(true)}>
            Retirar consentimento
          </button>
        </div>
      </div>
      <RevokeDialog open={revoking} onOpenChange={setRevoking} onRevoke={clear} />
    </div>
  );
}

/** Assistente com IA (spec 2026-11-18): conversa sobre os próprios dados, só leitura. */
export default function AssistantPage() {
  const config = useAssistantConfig();
  const { isDemo, user } = useAuth();
  const [revoking, setRevoking] = useState(false);
  const c = config.data;
  const usable = Boolean(c?.enabled && c.allowed);

  return (
    <>
      <PageHeader light="Seu" bold="assistente" description="Pergunte em português simples e receba respostas com os seus números." />
      {config.isPending && <ListSkeleton rows={3} />}
      {config.isError && <ErrorState message={config.error.message} onRetry={() => config.refetch()} />}
      {c && !c.enabled && (
        <Panel className="px-6">
          <EmptyState
            icon={<Sparkles aria-hidden className="h-6 w-6" strokeWidth={1.75} />}
            title="O assistente ainda não está ligado"
            description="Ele vai aparecer aqui assim que for configurado no servidor."
          />
        </Panel>
      )}
      {c?.enabled && !c.allowed && (
        <Panel className="px-6">
          <EmptyState
            icon={<Sparkles aria-hidden className="h-6 w-6" strokeWidth={1.75} />}
            title={isDemo ? 'Na conta demo, o assistente fica desligado' : 'O assistente não está liberado para a sua conta'}
            description={
              isDemo
                ? 'Crie a sua conta para conversar com o assistente sobre os seus próprios números.'
                : 'Por enquanto, ele está disponível só para algumas contas.'
            }
          />
        </Panel>
      )}
      {c?.enabled && c.allowed && !c.consented && <ConsentPanel />}
      {usable && c?.consented && user && <Chat key={user.id} userId={user.id} />}
      {/* Retirar o consentimento vale sempre, mesmo com o assistente desligado ou a conta fora da lista. */}
      {!usable && c?.consented && (
        <>
          <button type="button" className="mt-4 text-xs font-medium text-muted hover:underline" onClick={() => setRevoking(true)}>
            Retirar consentimento
          </button>
          <RevokeDialog open={revoking} onOpenChange={setRevoking} />
        </>
      )}
    </>
  );
}
