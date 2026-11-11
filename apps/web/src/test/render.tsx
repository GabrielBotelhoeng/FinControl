import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ThemeProvider } from '../app/theme';
import { AuthProvider } from '../features/auth/auth-context';
import type { AuthGateway } from '../features/auth/gateway';
import type { ApiClient } from '../lib/api-client';
import { ApiProvider } from '../lib/api-context';
import { fakeApi, fakeGateway, signedIn } from './fakes';

type Options = { gateway?: AuthGateway; api?: ApiClient; route?: string; path?: string; extraRoutes?: Record<string, ReactElement> };

export function renderApp(ui: ReactElement, opts: Options = {}) {
  const gateway = opts.gateway ?? fakeGateway(signedIn()).gateway;
  const api = opts.api ?? fakeApi();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const result = render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider gateway={gateway}>
          <ApiProvider client={api}>
            <MemoryRouter initialEntries={[opts.route ?? '/']}>
              <Routes>
                <Route path={opts.path ?? '*'} element={ui} />
                {Object.entries(opts.extraRoutes ?? {}).map(([path, element]) => (
                  <Route key={path} path={path} element={element} />
                ))}
              </Routes>
            </MemoryRouter>
          </ApiProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return { ...result, gateway, api, queryClient };
}
