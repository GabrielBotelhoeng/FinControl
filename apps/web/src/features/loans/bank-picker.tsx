import { useEffect, useState, type InputHTMLAttributes } from 'react';
import { Input } from '../../components/ui/field';
import { useBanks } from './api';

export type BankValue = { name: string; cnpj8: string | null };

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: BankValue;
  onChange: (value: BankValue) => void;
};

/**
 * Busca o banco entre as instituições do Banco Central (com espera de 250 ms entre teclas). Escolher preenche o
 * nome e o CNPJ, que liga a comparação de taxas; um nome digitado que não está na lista é aceito, sem CNPJ.
 * Repassa `id`/`aria-*` ao campo, para o `Field` ligar o rótulo.
 */
export function BankPicker({ value, onChange, ...inputProps }: Props) {
  const [query, setQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQuery(value.cnpj8 ? '' : value.name.trim()), 250);
    return () => clearTimeout(t);
  }, [value]);
  const banks = useBanks(query);
  const suggestions = value.cnpj8 ? [] : (banks.data ?? []);

  return (
    <div className="grid gap-2">
      <Input
        {...inputProps}
        value={value.name}
        onChange={(e) => onChange({ name: e.target.value, cnpj8: null })}
        placeholder="Ex.: Banco do Brasil"
        autoComplete="off"
      />
      {suggestions.length > 0 && (
        <ul aria-label="Bancos encontrados" className="grid max-h-48 gap-1 overflow-y-auto rounded-[var(--radius-control)] border border-border p-1">
          {suggestions.map((b) => (
            <li key={b.cnpj8}>
              <button
                type="button"
                className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-2"
                onClick={() => onChange({ name: b.name, cnpj8: b.cnpj8 })}
              >
                {b.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
