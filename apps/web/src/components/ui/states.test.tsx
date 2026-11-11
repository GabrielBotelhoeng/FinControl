import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';
import { EmptyState, ErrorState } from './states';

describe('estados', () => {
  it('ErrorState mostra a mensagem e chama onRetry', async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Servidor indisponível." onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Servidor indisponível.');
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('EmptyState renderiza título e ação', () => {
    render(<EmptyState title="Nenhuma conta ainda" description="Crie a primeira." action={<Button>Criar conta</Button>} />);
    expect(screen.getByRole('heading', { name: 'Nenhuma conta ainda' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeInTheDocument();
  });

  it('Button em loading fica desabilitado e anuncia o estado', () => {
    render(<Button loading>Salvar</Button>);
    const button = screen.getByRole('button', { name: /Salvar/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
