import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeApi, fakeGateway } from '../../test/fakes';
import { renderApp } from '../../test/render';
import { useStartDemo } from './use-start-demo';

function DemoButton() {
  const { start, pending, error } = useStartDemo();
  return (
    <>
      <button type="button" onClick={() => void start()} disabled={pending}>
        Demo
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}

describe('useStartDemo', () => {
  it('entra como anônimo e gera a demo uma vez só, mesmo com clique duplo', async () => {
    const { gateway } = fakeGateway(null);
    let release: () => void = () => {};
    const api = fakeApi({ 'POST /demo/seed': () => new Promise((r) => (release = () => r({ seeded: true }))) });
    renderApp(<DemoButton />, { gateway, api, route: '/site', path: '/site', extraRoutes: { '/': <p>Painel</p> } });
    const button = screen.getByRole('button', { name: 'Demo' });
    await userEvent.click(button);
    await userEvent.click(button);
    release();
    expect(await screen.findByText('Painel')).toBeInTheDocument();
    expect(gateway.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/demo/seed', undefined);
  });

  it('mostra o erro e libera nova tentativa reaproveitando o anônimo', async () => {
    const { gateway } = fakeGateway(null);
    let attempts = 0;
    const api = fakeApi({ 'POST /demo/seed': () => (++attempts === 1 ? new Error('Falha temporária') : { seeded: true }) });
    renderApp(<DemoButton />, { gateway, api, route: '/site', path: '/site', extraRoutes: { '/': <p>Painel</p> } });
    await userEvent.click(screen.getByRole('button', { name: 'Demo' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Demo' }));
    expect(await screen.findByText('Painel')).toBeInTheDocument();
    expect(gateway.signInAnonymously).toHaveBeenCalledTimes(1);
  });
});
