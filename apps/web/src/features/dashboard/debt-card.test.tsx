import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../test/render';
import { DebtCard } from './debt-card';

describe('DebtCard (R8)', () => {
  it('critério 6: total igual a cartões + empréstimos, com os links para as dívidas e os relatórios', async () => {
    renderApp(<DebtCard debts={{ cards: 110000, loans: 2477608, others: 0, total: 2587608 }} />);
    const card = await screen.findByRole('region', { name: 'Total de dívidas' });
    expect(card).toHaveTextContent(/R\$\s*25\.876,08/);
    expect(card).toHaveTextContent(/Cartões R\$\s*1\.100,00 · Empréstimos R\$\s*24\.776,08/);
    expect(card).not.toHaveTextContent('Credores');
    expect(screen.getByRole('link', { name: 'Ver relatórios' })).toHaveAttribute('href', '/relatorios');
    expect(screen.getByRole('link', { name: 'Ver dívidas' })).toHaveAttribute('href', '/dividas');
  });

  it('dívidas com credores entram na divisão quando existem (V11)', async () => {
    renderApp(<DebtCard debts={{ cards: 0, loans: 0, others: 21390, total: 21390 }} />);
    const card = await screen.findByRole('region', { name: 'Total de dívidas' });
    expect(card).toHaveTextContent(/Credores R\$\s*213,90/);
  });

  it('sem dívidas, diz isso com ícone e texto', async () => {
    renderApp(<DebtCard debts={{ cards: 0, loans: 0, others: 0, total: 0 }} />);
    expect(await screen.findByText('Nenhuma dívida em cartões, empréstimos ou com credores')).toBeInTheDocument();
  });
});
