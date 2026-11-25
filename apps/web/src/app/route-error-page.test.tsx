import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { lazy, Suspense } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouteErrorPage } from './route-error-page';
import { routes } from './routes';

// Um pedaço que sumiu depois do deploy: o import dinâmico falha.
const MissingChunk = lazy(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/x-abc.js')));

describe('RouteErrorPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('um lazy que falha mostra a tela em português com Atualizar, que recarrega', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
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
    expect(await screen.findByRole('heading', { name: 'Não deu para abrir esta tela' })).toBeInTheDocument();
    expect(screen.getByText(/você não precisa entrar de novo/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('todas as rotas de topo usam esta tela', () => {
    for (const route of routes) expect(route.errorElement, route.path).toBeDefined();
  });
});
