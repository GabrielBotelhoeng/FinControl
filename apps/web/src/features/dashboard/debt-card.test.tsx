import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../test/render';
import { DebtCard } from './debt-card';

describe('DebtCard (R8)', () => {
  it('critério 6: total igual a cartões + empréstimos, com o link para os relatórios', async () => {
    renderApp(<DebtCard debts={{ cards: 110000, loans: 2477608, total: 2587608 }} />);
    const card = await screen.findByRole('region', { name: 'Total de dívidas' });
    expect(card).toHaveTextContent(/R\$\s*25\.876,08/);
    expect(card).toHaveTextContent(/Cartões R\$\s*1\.100,00 · Empréstimos R\$\s*24\.776,08/);
    expect(screen.getByRole('link', { name: 'Ver relatórios' })).toHaveAttribute('href', '/relatorios');
  });

  it('sem dívidas, diz isso com ícone e texto', async () => {
    renderApp(<DebtCard debts={{ cards: 0, loans: 0, total: 0 }} />);
    expect(await screen.findByText('Nenhuma dívida em cartões ou empréstimos')).toBeInTheDocument();
  });
});
