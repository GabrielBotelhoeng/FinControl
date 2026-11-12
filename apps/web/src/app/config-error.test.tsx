import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConfigErrorScreen } from './config-error';

describe('ConfigErrorScreen', () => {
  it('explica o problema e nomeia as variáveis em vez de deixar a tela em branco', () => {
    render(<ConfigErrorScreen fields={['VITE_API_URL', 'VITE_SUPABASE_ANON_KEY']} />);
    expect(screen.getByRole('heading', { name: 'O FinControl não está configurado' })).toBeInTheDocument();
    expect(screen.getByText('VITE_API_URL')).toBeInTheDocument();
    expect(screen.getByText('VITE_SUPABASE_ANON_KEY')).toBeInTheDocument();
  });
});
