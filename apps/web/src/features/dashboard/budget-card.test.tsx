import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../test/render';
import { BudgetCard } from './budget-card';

describe('BudgetCard (P10)', () => {
  it('mostra comprometido ÷ orçamento, as categorias estouradas e o link para o planejamento', async () => {
    renderApp(<BudgetCard budget={{ limit: 80000, committed: 55000, nearCount: 0, overCount: 1 }} />);
    const card = await screen.findByRole('region', { name: 'Orçamento do mês' });
    expect(card).toHaveTextContent(/R\$\s*550,00 de R\$\s*800,00/);
    expect(card).toHaveTextContent('1 categoria estourou');
    expect(screen.getByRole('link', { name: 'Ver planejamento' })).toHaveAttribute('href', '/planejamento');
  });

  it('plural das contagens e "tudo dentro" quando nenhuma está perto ou estourada', async () => {
    const { unmount } = renderApp(<BudgetCard budget={{ limit: 80000, committed: 70000, nearCount: 2, overCount: 0 }} />);
    expect(await screen.findByRole('region', { name: 'Orçamento do mês' })).toHaveTextContent('2 categorias perto do limite');
    unmount();
    renderApp(<BudgetCard budget={{ limit: 80000, committed: 10000, nearCount: 0, overCount: 0 }} />);
    expect(await screen.findByRole('region', { name: 'Orçamento do mês' })).toHaveTextContent('Todas as categorias dentro do limite');
  });

  it('sem orçamento convida a definir limites', async () => {
    renderApp(<BudgetCard budget={null} />);
    expect(await screen.findByText('Defina limites por categoria para acompanhar o mês.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver planejamento' })).toHaveAttribute('href', '/planejamento');
  });
});
