import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { preloadable, retrying } from './preloadable';

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

  it('se a carga falhar, a próxima tenta de novo (não reaproveita a promessa rejeitada), e o lazy também', async () => {
    let calls = 0;
    const Lazy = preloadable(() => {
      calls += 1;
      return calls === 1 ? Promise.reject<{ default: typeof Page }>(new Error('rede')) : Promise.resolve({ default: Page });
    });
    await expect(Lazy.preload()).rejects.toThrow('rede');
    await Lazy.preload();
    expect(calls).toBe(2);
    render(<Lazy label="de novo" />);
    expect(screen.getByText('de novo')).toBeInTheDocument();
  });
});

describe('retrying (carga do pedaço da página antes de hidratar)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('tenta de novo depois de cada espera e resolve quando uma tentativa dá certo', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const load = () => (++calls < 3 ? Promise.reject(new Error('rede')) : Promise.resolve('ok'));
    const result = retrying(load, [1000, 3000]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toBe(2);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(result).resolves.toBe('ok');
    expect(calls).toBe(3);
  });

  it('rejeita depois da última tentativa', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const result = retrying(() => (calls++, Promise.reject(new Error('rede'))), [500]);
    const settled = expect(result).rejects.toThrow('rede');
    await vi.advanceTimersByTimeAsync(500);
    await settled;
    expect(calls).toBe(2);
  });
});
