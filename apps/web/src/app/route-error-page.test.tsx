import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { lazy, Suspense } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isChunkLoadError, RouteErrorPage } from './route-error-page';
import { routes } from './routes';

// Um pedaço que sumiu depois do deploy: o import dinâmico falha.
const MissingChunk = lazy(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/x-abc.js')));

describe('RouteErrorPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('um pedaço que não carrega é versão nova: mostra Atualizar, que recarrega, e loga o erro', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.fn();
    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <Suspense fallback={null}>
            <MissingChunk />
          </Suspense>
        ),
        errorElement: <RouteErrorPage reload={reload} />,
      },
    ]);
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole('heading', { name: 'Saiu uma versão nova do FinControl' })).toBeInTheDocument();
    expect(screen.getByText(/você não precisa entrar de novo/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('Erro ao abrir a tela:', expect.any(TypeError));
  });

  it('outro erro tem texto neutro, sem falar de versão nova; Tentar novamente abre a rota de novo, sem recarregar', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.fn();
    let fail = true;
    function Flaky() {
      if (fail) throw new Error('falhou ao montar');
      return <p>Tela aberta</p>;
    }
    const router = createMemoryRouter([{ path: '/contas', element: <Flaky />, errorElement: <RouteErrorPage reload={reload} /> }], {
      initialEntries: ['/contas'],
    });
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole('heading', { name: 'Algo deu errado ao abrir esta tela' })).toBeInTheDocument();
    expect(screen.queryByText(/versão nova/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Atualizar' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/');
    expect(log).toHaveBeenCalledWith('Erro ao abrir a tela:', expect.objectContaining({ message: 'falhou ao montar' }));
    fail = false;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Tela aberta')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/contas');
    expect(reload).not.toHaveBeenCalled();
  });

  it('reconhece as mensagens de pedaço que não carrega dos navegadores e do Vite', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/a.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: /assets/a.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/a.css'))).toBe(true);
    expect(isChunkLoadError(Object.assign(new Error('Loading chunk 3 failed'), { name: 'ChunkLoadError' }))).toBe(true);
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError({ status: 404 })).toBe(false);
  });

  it('todas as rotas de topo usam esta tela', () => {
    for (const route of routes) expect(route.errorElement, route.path).toBeDefined();
  });
});
