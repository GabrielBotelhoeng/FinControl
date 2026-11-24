import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { formatBRL } from '../../lib/format';
import { fakeApi, fakeGateway } from '../../test/fakes';
import { FAQ } from './faq-data';
import { PLANS } from './pricing';
import { renderSitePage } from './render-site';

const complete = PLANS.find((p) => p.id === 'complete')!;
const renderSite = (opts: Parameters<typeof renderSitePage>[0] = {}) => renderSitePage({ gateway: fakeGateway(null).gateway, ...opts });

/** Compara textos de dinheiro ignorando o tipo de espaço (o formatador usa espaço não separável). */
const norm = (text: string | null | undefined) => (text ?? '').replace(/\s/g, ' ');

describe('planos', () => {
  it('mostra os preços de pricing.ts, o selo de provisório e o aviso de que hoje tudo é grátis', async () => {
    await renderSite();
    expect(screen.getByText('Preços de lançamento, provisórios')).toBeInTheDocument();
    expect(screen.getByText('Hoje todos os recursos estão liberados de graça.')).toBeInTheDocument();
    const card = screen.getByRole('article', { name: complete.name });
    expect(norm(within(card).getByTestId('preco-complete').textContent)).toContain(norm(formatBRL(complete.monthlyCents)));
    for (const f of complete.features) expect(within(card).getByText(f)).toBeInTheDocument();
  });

  it('a chave troca mensal ↔ anual, pelo clique e pelas setas do teclado', async () => {
    await renderSite();
    const group = screen.getByRole('radiogroup', { name: 'Forma de pagamento' });
    const price = () => screen.getByTestId('preco-complete').textContent ?? '';
    expect(price()).toMatch(/por mês/);

    await userEvent.click(within(group).getByRole('radio', { name: /Anual/ }));
    expect(within(group).getByRole('radio', { name: /Anual/ })).toHaveAttribute('aria-checked', 'true');
    expect(price()).toMatch(/por ano/);
    expect(norm(price())).toContain(norm(formatBRL(complete.yearlyCents)));

    await userEvent.keyboard('{ArrowLeft}');
    expect(within(group).getByRole('radio', { name: 'Mensal' })).toHaveAttribute('aria-checked', 'true');
    expect(price()).toMatch(/por mês/);
  });

  it('os botões dos planos abrem a demo', async () => {
    const { gateway } = fakeGateway(null);
    const api = fakeApi({ 'POST /demo/seed': { seeded: true } });
    await renderSite({ gateway, api });
    await userEvent.click(screen.getByRole('button', { name: 'Experimentar o Completo' }));
    expect(gateway.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/demo/seed', undefined);
  });
});

describe('perguntas', () => {
  it('lista todas as perguntas fechadas, e o acordeão abre e fecha pelo teclado', async () => {
    await renderSite();
    const section = document.getElementById('perguntas')!;
    const buttons = within(section).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(FAQ.map((f) => f.question));
    const first = buttons[0]!;
    expect(first).toHaveAttribute('aria-expanded', 'false');
    const panel = document.getElementById(first.getAttribute('aria-controls')!)!;
    expect(panel).toHaveAttribute('inert');

    first.focus();
    await userEvent.keyboard('{Enter}');
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(panel).not.toHaveAttribute('inert');
    expect(panel).toHaveTextContent(FAQ[0]!.answer);

    await userEvent.keyboard(' ');
    expect(first).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('chamada final', () => {
  it('tem o botão da demo', async () => {
    const { gateway } = fakeGateway(null);
    const api = fakeApi({ 'POST /demo/seed': { seeded: true } });
    await renderSite({ gateway, api });
    const cta = screen.getByRole('region', { name: /Comece agora/ });
    await userEvent.click(within(cta).getByRole('button', { name: 'Experimentar sem cadastro' }));
    expect(gateway.signInAnonymously).toHaveBeenCalledTimes(1);
  });
});
