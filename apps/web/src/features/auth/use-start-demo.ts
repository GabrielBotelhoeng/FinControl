import { useCallback, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router';
import { useApi } from '../../lib/api-context';
import { useAuth } from './auth-context';
import { translateAuthError } from './gateway';

/**
 * Estado do início da demo, fora do React (store de módulo): o login anônimo já troca a `/` do site para o app, e o
 * estado não pode morrer com o site. Assim o portão da `/` continua mostrando o site enquanto a demo está sendo gerada
 * ou se ela falhou depois do login anônimo, com o erro e o botão de tentar de novo (CodeRabbit, PR #39).
 */
export type DemoStart = { status: 'idle' | 'pending' | 'failed'; error: string | null };

const IDLE: DemoStart = { status: 'idle', error: null };
let state: DemoStart = IDLE;
const listeners = new Set<() => void>();

function setState(next: DemoStart) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getState = () => state;

/** O estado atual do início da demo, para quem só precisa ler (o portão da `/`). */
export function useDemoStart(): DemoStart {
  return useSyncExternalStore(subscribe, getState, getState);
}

/** Só para os testes: volta ao estado inicial entre um teste e outro. */
export function resetDemoStartForTests() {
  state = IDLE;
}

/**
 * Início da demo sem cadastro (sub-projeto 17): entra como anônimo, gera os dados de exemplo e abre o painel.
 * Usado pela entrada e pelo site de apresentação. O estado "pendente" é a trava contra o clique duplo.
 */
export function useStartDemo() {
  const { gateway } = useAuth();
  const api = useApi();
  const navigate = useNavigate();
  const demo = useDemoStart();

  const start = useCallback(async () => {
    if (state.status === 'pending') return;
    setState({ status: 'pending', error: null });
    try {
      // Nova tentativa depois de uma falha no seed: reaproveita o anônimo que já existe em vez de criar outro.
      if (!(await gateway.getSession())?.user.isAnonymous) await gateway.signInAnonymously();
      await api.post('/demo/seed', undefined);
      setState(IDLE);
      navigate('/', { replace: true });
    } catch (err) {
      setState({ status: 'failed', error: translateAuthError(err) });
    }
  }, [gateway, api, navigate]);

  /** Apaga o erro de uma tentativa que falhou (ex.: a pessoa foi criar conta ou pedir a redefinição de senha). */
  const reset = useCallback(() => {
    if (state.status === 'failed') setState(IDLE);
  }, []);

  return { start, reset, pending: demo.status === 'pending', error: demo.error };
}
