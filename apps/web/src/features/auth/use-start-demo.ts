import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useApi } from '../../lib/api-context';
import { useAuth } from './auth-context';
import { translateAuthError } from './gateway';

/**
 * Início da demo sem cadastro (sub-projeto 17): entra como anônimo, gera os dados de exemplo e abre o painel.
 * Usado pela entrada e pelo site de apresentação. A trava impede o clique duplo de criar dois anônimos.
 */
export function useStartDemo() {
  const { gateway } = useAuth();
  const api = useApi();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const start = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError(null);
    try {
      // Nova tentativa depois de uma falha no seed: reaproveita o anônimo que já existe em vez de criar outro.
      if (!(await gateway.getSession())?.user.isAnonymous) await gateway.signInAnonymously();
      await api.post('/demo/seed', undefined);
      navigate('/', { replace: true });
    } catch (err) {
      setError(translateAuthError(err));
      lock.current = false;
      setPending(false);
    }
  }, [gateway, api, navigate]);

  return { start, pending, error };
}
