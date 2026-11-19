import {
  parseStatement, StatementError,
  type CategoryDTO, type ImportCommitDTO, type ImportPreviewDTO, type ImportPreviewRowDTO,
} from '@fincontrol/shared';
import { ArrowLeftRight, CopyCheck, FileUp, Sparkles } from 'lucide-react';
import { memo, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { controlClass, Field, Select } from '../../components/ui/field';
import { PageHeader } from '../../components/ui/page-header';
import { Panel } from '../../components/ui/panel';
import { ErrorState } from '../../components/ui/states';
import { useApi } from '../../lib/api-context';
import { cn } from '../../lib/cn';
import { formatBRL, formatDate } from '../../lib/format';
import { useAccounts, useFinanceMutation } from '../accounts/api';
import { useCategories } from '../categories/api';

type Row = ImportPreviewRowDTO & { include: boolean };

const BOM = new RegExp(`^${String.fromCharCode(0xfeff)}`);

/** I1: UTF-8 primeiro; se não for válido, Windows-1252, a codificação dos OFX de muitos bancos brasileiros. */
export async function readStatementFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(BOM, '');
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

const SUGGESTION_LABEL: Record<ImportPreviewRowDTO['suggestion'], string> = {
  history: 'Aprendida do seu histórico',
  keyword: 'Sugerida pela descrição',
  fallback: 'Escolha a categoria',
};

type RowItemProps = { row: Row; index: number; categories: CategoryDTO[]; onChange: (index: number, patch: Partial<Row>) => void };

/** `memo` com callback estável: marcar uma linha não redesenha as outras 999 (revisão final). */
const RowItem = memo(function RowItem({ row, index, categories, onChange }: RowItemProps) {
  const options = categories.filter((c) => c.type === row.type);
  const income = row.type === 'income';
  return (
    <li className={cn('grid gap-3 py-4 sm:grid-cols-[auto_minmax(0,1fr)_12rem_14rem] sm:items-center', !row.include && 'opacity-60')}>
      <input
        type="checkbox"
        className="h-5 w-5 accent-[var(--primary)]"
        checked={row.include}
        onChange={(e) => onChange(index, { include: e.target.checked })}
        aria-label={`Importar ${row.description} de ${formatDate(row.date)}`}
      />
      <div className="min-w-0">
        <p className="break-words text-sm font-medium">{row.description}</p>
        <p className="text-xs text-muted">
          {formatDate(row.date)}
          {row.duplicate && <span className="ml-2 inline-flex items-center gap-1 font-medium text-warning"><CopyCheck aria-hidden className="h-3.5 w-3.5" />Parece repetido</span>}
          {!row.duplicate && row.transferLike && (
            <span className="ml-2 inline-flex items-center gap-1 font-medium text-warning">
              <ArrowLeftRight aria-hidden className="h-3.5 w-3.5" />
              Parece fatura ou transferência entre suas contas
            </span>
          )}
        </p>
      </div>
      <span className={cn('tabular text-sm font-semibold sm:text-right', income && 'text-income')}>{`${income ? '+' : '−'}${formatBRL(row.amount)}`}</span>
      <div className="grid gap-1">
        <Select
          aria-label={`Categoria de ${row.description}`}
          value={row.categoryId ?? ''}
          onChange={(e) => onChange(index, { categoryId: e.target.value, suggestion: 'history' })}
          className="h-10"
        >
          {!row.categoryId && <option value="">Escolha…</option>}
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        {row.suggestion !== 'history' && <span className="text-xs text-muted">{SUGGESTION_LABEL[row.suggestion]}</span>}
      </div>
    </li>
  );
});

/** Importar extrato (sub-projeto 9): escolher a conta e o arquivo, revisar e confirmar. */
export default function ImportPage() {
  const api = useApi();
  const navigate = useNavigate();
  const accounts = useAccounts();
  const categories = useCategories();
  const [accountId, setAccountId] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  // A prévia guarda a conta para a qual foi feita: os repetidos valem para ela, e o commit vai para ela.
  const [previewAccount, setPreviewAccount] = useState('');
  const request = useRef(0);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const commit = useFinanceMutation((body: { accountId: string; rows: { date: string; description: string; amount: number; categoryId: string }[] }) =>
    api.post<ImportCommitDTO>('/imports/commit', body),
  );

  const changeRow = useCallback((index: number, patch: Partial<Row>) => {
    setRows((cur) => cur && cur.map((x, j) => (j === index ? { ...x, ...patch } : x)));
  }, []);

  const targets = (accounts.data ?? []).filter((a) => a.archivedAt === null && a.type !== 'credit_card');
  const account = accountId || targets[0]?.id || '';
  const chosen = rows?.filter((r) => r.include) ?? [];
  const missing = chosen.filter((r) => !r.categoryId).length;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setRows(null);
    setFileName(file.name);
    if (!account) return setError('Cadastre uma conta (corrente, poupança ou carteira) antes de importar.');
    setLoading(true);
    const ticket = ++request.current;
    const target = account;
    try {
      const parsed = parseStatement(await readStatementFile(file));
      const preview = await api.post<ImportPreviewDTO>('/imports/preview', { accountId: target, rows: parsed.rows });
      if (ticket !== request.current) return; // outra leitura começou depois: esta resposta é velha
      setPreviewAccount(target);
      setRows(preview.rows.map((r) => ({ ...r, include: !r.duplicate && !r.transferLike })));
      if (parsed.skipped > 0) toast.info(`${parsed.skipped} ${parsed.skipped === 1 ? 'linha sem data ou valor ficou' : 'linhas sem data ou valor ficaram'} de fora.`);
    } catch (err) {
      setError(err instanceof StatementError || err instanceof Error ? err.message : 'Não foi possível ler o arquivo.');
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!rows || missing > 0 || chosen.length === 0) return;
    try {
      const res = await commit.mutateAsync({
        accountId: previewAccount,
        rows: chosen.map((r) => ({ date: r.date, description: r.description, amount: r.type === 'expense' ? -r.amount : r.amount, categoryId: r.categoryId! })),
      });
      toast.success(`${res.created} ${res.created === 1 ? 'lançamento importado' : 'lançamentos importados'}.`);
      navigate('/lancamentos');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível importar.');
    }
  }

  return (
    <>
      <PageHeader
        light="Importar"
        bold="extrato"
        description="Traga os lançamentos do banco de uma vez: arquivo OFX ou CSV, que o internet banking exporta."
      />

      {accounts.isError && <ErrorState message={accounts.error.message} onRetry={() => accounts.refetch()} />}

      <div className="grid grid-cols-1 gap-6">
        <Panel className="grid gap-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Conta do extrato">
              <Select
                value={account}
                onChange={(e) => {
                  setAccountId(e.target.value);
                  setRows(null);
                  setFileName('');
                  request.current += 1;
                }}
                disabled={!accounts.data || loading}
              >
                {targets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Arquivo OFX ou CSV" hint={fileName || 'No app do banco, procure por "exportar extrato".'}>
              <input
                type="file"
                accept=".ofx,.csv,.txt,text/csv,application/x-ofx"
                className={cn(controlClass, 'py-2 file:mr-3 file:rounded-full file:border-0 file:bg-surface file:px-3 file:py-1 file:text-sm')}
                onChange={(e) => {
                  void onFile(e.target.files?.[0]);
                  // Limpa o campo: escolher o mesmo arquivo de novo (outra conta) dispara a leitura outra vez.
                  e.target.value = '';
                }}
                disabled={!accounts.data || loading}
              />
            </Field>
          </div>
          <p className="inline-flex items-start gap-2 text-xs text-muted">
            <Sparkles aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            O arquivo é lido no seu navegador. As categorias são sugeridas pelo que você já lançou: quanto mais usa, mais acerta.
          </p>
          {error && (
            <p role="alert" className="text-sm font-medium text-expense">
              {error}
            </p>
          )}
          {loading && (
            <p role="status" className="text-sm text-muted">
              Lendo o arquivo…
            </p>
          )}
          {categories.isError && <ErrorState message={categories.error.message} onRetry={() => categories.refetch()} />}
        </Panel>

        {rows && (
          <Panel role="region" aria-label="Lançamentos do extrato" className="grid gap-2 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold tracking-tight">{`${rows.length} ${rows.length === 1 ? 'lançamento' : 'lançamentos'} no arquivo`}</h2>
              <span className="text-sm text-muted">
                {rows.some((r) => r.duplicate || r.transferLike) &&
                  `${rows.filter((r) => r.duplicate || r.transferLike).length} parecem repetidos ou transferências e ficaram desmarcados.`}
              </span>
            </div>
            <ul className="divide-y divide-border">
              {rows.map((r, i) => (
                <RowItem key={`${r.date}-${i}`} row={r} index={i} categories={categories.data ?? []} onChange={changeRow} />
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-end gap-3 pt-3">
              {missing > 0 && <span className="text-sm text-expense">{`Escolha a categoria de ${missing} ${missing === 1 ? 'lançamento' : 'lançamentos'}.`}</span>}
              <Button onClick={confirm} loading={commit.isPending} disabled={chosen.length === 0 || missing > 0}>
                <FileUp aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                {`Importar ${chosen.length} ${chosen.length === 1 ? 'lançamento' : 'lançamentos'}`}
              </Button>
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
