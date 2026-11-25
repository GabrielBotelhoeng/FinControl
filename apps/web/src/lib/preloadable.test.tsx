import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { describe, expect, it } from 'vitest';
import { preloadable } from './preloadable';

const Page = ({ label }: { label: string }) => <p>{label}</p>;

describe('preloadable (sub-projeto 18: hidratar sem jogar fora o HTML estático)', () => {
  it('sem pré-carga, funciona como o lazy: mostra o fallback e depois a página', async () => {
    const Lazy = preloadable(() => Promise.resolve({ default: Page }));
    render(
      <Suspense fallback={<p>carregando</p>}>
        <Lazy label="pagina" />
      </Suspense>,
    );
    expect(screen.getByText('carregando')).toBeInTheDocument();
    expect(await screen.findByText('pagina')).toBeInTheDocument();
  });

  it('pré-carregada, desenha na hora, sem suspender (o React não deixa a parte desidratada)', async () => {
    const Lazy = preloadable(() => Promise.resolve({ default: Page }));
    await Lazy.preload();
    render(
      <Suspense fallback={<p>carregando</p>}>
        <Lazy label="pagina" />
      </Suspense>,
    );
    expect(screen.queryByText('carregando')).toBeNull();
    expect(screen.getByText('pagina')).toBeInTheDocument();
  });

  it('a pré-carga busca o módulo uma vez só', async () => {
    let calls = 0;
    const Lazy = preloadable(() => {
      calls += 1;
      return Promise.resolve({ default: Page });
    });
    await Promise.all([Lazy.preload(), Lazy.preload()]);
    render(<Lazy label="x" />);
    expect(calls).toBe(1);
  });
});
