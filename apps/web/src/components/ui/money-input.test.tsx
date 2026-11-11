import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MoneyInput } from './money-input';

function Harness({ onValue }: { onValue: (v: number | null) => void }) {
  const [value, setValue] = useState<number | null>(null);
  return (
    <MoneyInput
      aria-label="Valor"
      value={value}
      onChange={(v) => {
        setValue(v);
        onValue(v);
      }}
    />
  );
}

describe('MoneyInput', () => {
  it('digitar 1234 mostra 12,34 e emite 1234 centavos', async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await userEvent.type(screen.getByLabelText('Valor'), '1234');
    expect(screen.getByLabelText('Valor')).toHaveValue('12,34');
    expect(onValue).toHaveBeenLastCalledWith(1234);
  });

  it('colar "R$ 1.234,56" emite 123456', async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await userEvent.click(screen.getByLabelText('Valor'));
    await userEvent.paste('R$ 1.234,56');
    expect(onValue).toHaveBeenLastCalledWith(123456);
    expect(screen.getByLabelText('Valor')).toHaveValue('1.234,56');
  });

  it('apagar tudo emite null', async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await userEvent.type(screen.getByLabelText('Valor'), '5');
    await userEvent.clear(screen.getByLabelText('Valor'));
    expect(onValue).toHaveBeenLastCalledWith(null);
  });
});
