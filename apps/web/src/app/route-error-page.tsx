import { useEffect } from 'react';
import { useRouteError } from 'react-router';
import { Button } from '../components/ui/button';
import { Logo } from '../components/ui/logo';

const reloadPage = () => window.location.reload();

/**
 * A tela quando uma rota quebra (sub-projeto 19, A4), no lugar da tela padrão do React Router (em inglês, sem saída). O
 * caso comum é um pedaço antigo que sumiu depois de um deploy: atualizar busca a versão nova, e a sessão continua (A5).
 */
export function RouteErrorPage({ reload = reloadPage }: { reload?: () => void }) {
  const error = useRouteError();
  useEffect(() => {
    console.error('Erro ao abrir a tela:', error);
  }, [error]);
  return (
    <div className="aurora grid min-h-dvh place-items-center px-4">
      <main className="flex max-w-md flex-col items-center gap-6 text-center">
        <Logo />
        <h1 className="font-display text-[clamp(1.75rem,5vw,2.25rem)] font-extrabold leading-tight tracking-[-0.02em]">
          Não deu para abrir esta tela
        </h1>
        <p className="text-[0.95rem] leading-relaxed text-muted">
          Pode ser uma versão nova do FinControl. Atualize a página para continuar; você não precisa entrar de novo.
        </p>
        <Button size="lg" onClick={reload}>
          Atualizar
        </Button>
      </main>
    </div>
  );
}
