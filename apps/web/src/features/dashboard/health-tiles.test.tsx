import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HealthTiles } from './health-tiles';

const base = { liquidBalance: 700000, averageMonthlyExpense: 100000, debtCommitment: null, debtPayments: 0 };

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
    render(<HealthTiles health={{ liquidBalance: 0, averageMonthlyExpense: null, savingsRate: null, reserveMonths: null, debtCommitment: null, debtPayments: 0 }} />);
    expect(screen.getByRole('group', { name: 'Taxa de poupança' })).toHaveTextContent('Sem receitas pagas neste mês');
    expect(screen.getByRole('group', { name: 'Reserva de emergência' })).toHaveTextContent('Lance suas despesas por um mês completo');
  });

  it('o status segue o número exibido (19,5% aparece como 20% e está na meta)', () => {
    render(<HealthTiles health={{ ...base, savingsRate: 0.195, reserveMonths: 3 }} />);
    expect(screen.getByRole('group', { name: 'Taxa de poupança' })).toHaveTextContent('20%');
    expect(screen.getByRole('group', { name: 'Taxa de poupança' })).toHaveTextContent('Na meta');
    expect(screen.getByRole('group', { name: 'Reserva de emergência' })).toHaveTextContent(/Hoje: /);
  });

  it('mostra o comprometimento de renda com a meta de 30% e a faixa escrita', () => {
    const { rerender } = render(<HealthTiles health={{ ...base, savingsRate: 0.2, reserveMonths: 3, debtCommitment: 0.06, debtPayments: 30000 }} />);
    const tile = () => screen.getByRole('group', { name: 'Comprometimento de renda' });
    expect(tile()).toHaveTextContent('6%');
    expect(tile()).toHaveTextContent('Na meta');
    expect(tile()).toHaveTextContent('Meta: até 30% da renda');

    rerender(<HealthTiles health={{ ...base, savingsRate: 0.2, reserveMonths: 3, debtCommitment: 0.35, debtPayments: 30000 }} />);
    expect(tile()).toHaveTextContent('Atenção');

    rerender(<HealthTiles health={{ ...base, savingsRate: 0.2, reserveMonths: 3, debtCommitment: 0.5, debtPayments: 30000 }} />);
    expect(tile()).toHaveTextContent('Alto');
  });

  it('comprometimento sem receitas mostra "—" e explica', () => {
    render(<HealthTiles health={{ ...base, savingsRate: null, reserveMonths: 3, debtCommitment: null, debtPayments: 0 }} />);
    const tile = screen.getByRole('group', { name: 'Comprometimento de renda' });
    expect(tile).toHaveTextContent('—');
    expect(tile).toHaveTextContent('Sem receitas nos últimos 3 meses.');
  });

  it('o status do comprometimento segue o número exibido (30,5% aparece como 31% e pede atenção)', () => {
    render(<HealthTiles health={{ ...base, savingsRate: 0.2, reserveMonths: 3, debtCommitment: 0.305, debtPayments: 30000 }} />);
    const tile = screen.getByRole('group', { name: 'Comprometimento de renda' });
    expect(tile).toHaveTextContent('31%');
    expect(tile).toHaveTextContent('Atenção');
  });
});
