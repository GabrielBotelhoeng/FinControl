import { useEffect } from 'react';
import { Link, useLocation, useNavigate, useRouteError } from 'react-router';
import { Button } from '../components/ui/button';
import { Logo } from '../components/ui/logo';

const reloadPage = () => window.location.reload();

/**
 * Um pedaço do app que não carregou: o `import()` de um arquivo que sumiu depois de um deploy. As mensagens são as do
 * Chromium, do Firefox e do Safari para o import dinâmico, a do Vite para o CSS pré-carregado e o `ChunkLoadError`.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'ChunkLoadError') return true;
  return /dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(error.message);
}

/**
 * A tela quando uma rota quebra (sub-projeto 19, A4), no lugar da tela padrão do React Router (em inglês, sem saída). Se
 * o que falhou foi um pedaço que não carregou, é uma versão nova: atualizar a busca, e a sessão continua (A5). Qualquer
 * outro erro tem um texto neutro, "Tentar novamente" (abre a mesma rota de novo) e o caminho para o início.
 */
export function RouteErrorPage({ reload = reloadPage }: { reload?: () => void }) {
  const error = useRouteError();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    console.error('Erro ao abrir a tela:', error);
  }, [error]);
  const newVersion = isChunkLoadError(error);
  // Uma navegação nova para o mesmo endereço limpa o erro do roteador e monta a rota outra vez.
  const retry = () => void navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true });
  return (
    <div className="aurora grid min-h-dvh place-items-center px-4">
      <main className="flex max-w-md flex-col items-center gap-6 text-center">
        <Logo />
        <h1 className="font-display text-[clamp(1.75rem,5vw,2.25rem)] font-extrabold leading-tight tracking-[-0.02em]">
          {newVersion ? 'Saiu uma versão nova do FinControl' : 'Algo deu errado ao abrir esta tela'}
        </h1>
        <p className="text-[0.95rem] leading-relaxed text-muted">
          {newVersion
            ? 'Atualize a página para continuar; você não precisa entrar de novo.'
            : 'Tente de novo. Se continuar, volte ao início e abra a tela outra vez.'}
        </p>
        {newVersion ? (
          <Button size="lg" onClick={reload}>
            Atualizar
          </Button>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Button size="lg" onClick={retry}>
              Tentar novamente
            </Button>
            <Link to="/" className="text-sm font-semibold text-primary underline underline-offset-4">
              Voltar ao início
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
