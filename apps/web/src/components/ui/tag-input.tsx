import { compareTags, MAX_TAGS, tagSchema } from '@fincontrol/shared';
import { X } from 'lucide-react';
import { useId, useState } from 'react';
import { cn } from '../../lib/cn';
import { controlClass } from './field';

type Props = {
  value: string[];
  onChange: (tags: string[]) => void;
  /**
   * O texto ainda não confirmado, controlado por quem usa (o formulário o inclui ao salvar). Sem ele, o campo guarda
   * o texto sozinho.
   */
  draft?: string;
  onDraftChange?: (draft: string) => void;
  suggestions?: string[];
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
};

/** Tags do lançamento (sub-projeto 13, T7): Enter ou vírgula vira etiqueta; sugere as tags já usadas. */
export function TagInput({ value, onChange, draft: controlledDraft, onDraftChange, suggestions = [], ...inputProps }: Props) {
  const [ownDraft, setOwnDraft] = useState('');
  const draft = controlledDraft ?? ownDraft;
  const setDraft = onDraftChange ?? setOwnDraft;
  const [error, setError] = useState<string | null>(null);
  const listId = useId();
  const errorId = useId();
  const full = value.length >= MAX_TAGS;
  // Quando o `Field` em volta já mostra um erro (ao salvar), o aviso daqui não se repete embaixo dele.
  const ownError = error !== null && !inputProps['aria-invalid'];

  function add(raw: string) {
    if (!raw.trim()) {
      setDraft('');
      return;
    }
    const parsed = tagSchema.safeParse(raw);
    if (!parsed.success) {
      // O texto fica no campo, para a pessoa corrigir em vez de digitar de novo.
      setDraft(raw);
      setError(parsed.error.issues[0]?.message ?? 'Tag inválida');
      return;
    }
    setDraft('');
    setError(null);
    if (full || value.includes(parsed.data)) return;
    onChange([...value, parsed.data].sort(compareTags));
  }

  return (
    <div className="grid gap-2">
      {value.length > 0 && (
        <ul aria-label="Tags escolhidas" className="flex flex-wrap gap-1.5">
          {value.map((t) => (
            <li key={t} className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-2 py-1 pl-2.5 pr-1 text-xs font-medium">
              <span className="truncate">{`#${t}`}</span>
              <button
                type="button"
                aria-label={`Remover a tag ${t}`}
                onClick={() => onChange(value.filter((x) => x !== t))}
                className="shrink-0 rounded-full p-0.5 text-muted hover:text-text"
              >
                <X aria-hidden className="h-3 w-3" strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        {...inputProps}
        aria-invalid={inputProps['aria-invalid'] || ownError || undefined}
        aria-describedby={[inputProps['aria-describedby'], ownError && errorId].filter(Boolean).join(' ') || undefined}
        type="text"
        list={listId}
        autoComplete="off"
        className={cn(controlClass)}
        value={draft}
        disabled={full}
        placeholder={full ? `Máximo de ${MAX_TAGS} tags` : 'Ex.: bebida (Enter para adicionar)'}
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(',')) add(v.slice(0, -1));
          else {
            setDraft(v);
            setError(null);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            // Enter adiciona a tag, sem enviar o formulário.
            e.preventDefault();
            add(draft);
          } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
      />
      <datalist id={listId}>
        {suggestions
          .filter((s) => !value.includes(s))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
      {ownError && (
        <p id={errorId} className="text-xs font-medium text-expense">
          {error}
        </p>
      )}
    </div>
  );
}
