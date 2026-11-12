import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HealthTiles } from './health-tiles';

const base = { liquidBalance: 700000, averageMonthlyExpense: 100000 };

describe('HealthTiles', () => {
  it('mostra taxa de poupança e meses de reserva com status escrito e a meta', () => {
    render(<HealthTiles health={{ ...base, savingsRate: 0.25, reserveMonths: 7 }} />);
    expect(screen.getByRole('group', { name: 'Taxa de poupança' })).toHaveTextContent('25%');
    expect(screen.getByRole('group', { name: 'Taxa de poupança' })).toHaveTextContent('Na meta');
    expect(screen.getByRole('group', { name: 'Taxa de poupança' })).toHaveTextContent('Meta: guardar 20% da renda');
    const reserve = screen.getByRole('group', { name: 'Reserva de emergência' });
    expect(reserve).toHaveTextContent('7 meses');
    expect(reserve).toHaveTextContent('Reserva completa');
    expect(reserve).toHaveTextContent('Meta: 3 a 6 meses do seu gasto médio');
  });

  it('sinaliza abaixo da meta e no vermelho', () => {
    render(<HealthTiles health={{ ...base, savingsRate: -0.5, reserveMonths: 1.5 }} />);
    expect(screen.getByRole('group', { name: 'Taxa de poupança' })).toHaveTextContent('Gastou mais do que ganhou');
    expect(screen.getByRole('group', { name: 'Reserva de emergência' })).toHaveTextContent('1,5 mês');
    expect(screen.getByRole('group', { name: 'Reserva de emergência' })).toHaveTextContent('Abaixo da meta');
  });

  it('explica quando ainda não dá para calcular', () => {
    render(<HealthTiles health={{ liquidBalance: 0, averageMonthlyExpense: null, savingsRate: null, reserveMonths: null }} />);
    expect(screen.getByRole('group', { name: 'Taxa de poupança' })).toHaveTextContent('Sem receitas pagas neste mês');
    expect(screen.getByRole('group', { name: 'Reserva de emergência' })).toHaveTextContent('Lance suas despesas por um mês completo');
  });
});
