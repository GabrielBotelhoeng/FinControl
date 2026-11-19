import { endOfMonth, monthOf, startOfMonth, todayInSaoPaulo, type TransactionDTO, type TransactionType, type YearMonth } from '@fincontrol/shared';
import { ArrowLeftRight, FileUp, Plus, Search } from 'lucide-react';
import { useDeferredValue, useMemo, useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { Input, Select } from '../../components/ui/field';
import { MonthPicker } from '../../components/ui/month-picker';
import { PageHeader } from '../../components/ui/page-header';
import { Panel } from '../../components/ui/panel';
import { Segmented } from '../../components/ui/segmented';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/ui/states';
import { useAccounts } from '../accounts/api';
import { useCategories } from '../categories/api';
import { useTags } from '../tags/api';
import { useTransactions } from './api';
import { groupByDay } from './group-by-day';
import { TransactionForm } from './transaction-form';
import { TransactionRow } from './transaction-row';

type TypeFilter = 'all' | TransactionType;

export default function TransactionsPage() {
  const today = todayInSaoPaulo();
  // `?mes=AAAA-MM` abre no mês pedido (o "Pagar" das notificações leva ao mês do vencimento).
  const [params, setParams] = useSearchParams();
  const requested = params.get('mes');
  const [month, setMonth] = useState<YearMonth>(requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : monthOf(today));
  const [type, setType] = useState<TypeFilter>('all');
  const [status, setStatus] = useState<'' | 'pending' | 'paid'>('');
  const [accountId, setAccountId] = useState('');
  const [tag, setTag] = useState('');
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  // `?novo=1` (atalho do ícone do app) já abre o formulário de novo lançamento.
  const [editing, setEditing] = useState<TransactionDTO | 'new' | null>(params.get('novo') === '1' ? 'new' : null);
  // O `?novo=1` sai da URL assim que é usado: voltar no histórico não reabre o formulário, e nada muda a URL depois (CodeRabbit).
  useEffect(() => {
    if (!params.has('novo')) return;
    const next = new URLSearchParams(params);
    next.delete('novo');
    setParams(next, { replace: true });
  }, [params, setParams]);

  const filters = useMemo(
    () => ({
      from: startOfMonth(month),
      to: endOfMonth(month),
      type: type === 'all' ? undefined : type,
      status: status || undefined,
      accountId: accountId || undefined,
      q: q || undefined,
      tag: tag || undefined,
    }),
    [month, type, status, accountId, q, tag],
  );

  const transactions = useTransactions(filters);
  const accounts = useAccounts(true);
  const categories = useCategories();
  const tags = useTags();
  const accountById = new Map((accounts.data ?? []).map((a) => [a.id, a]));
  const categoryById = new Map((categories.data ?? []).map((c) => [c.id, c]));
  const items = transactions.data?.pages.flatMap((p) => p.items) ?? [];
  const groups = groupByDay(items, today);
  const filtered = type !== 'all' || status !== '' || accountId !== '' || q !== '';

  return (
    <>
      <PageHeader
        light="Seus"
        bold="lançamentos"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
              Novo lançamento
            </Button>
            <Link
              to="/importar"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-medium hover:border-muted"
            >
              <FileUp aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Importar extrato
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-3">
        <div className="grid min-w-0 gap-3 sm:flex sm:flex-wrap sm:items-center">
          <MonthPicker value={month} onChange={setMonth} />
          <div className="min-w-0 overflow-x-auto [scrollbar-width:none]">
          <Segmented
            label="Tipo"
            value={type}
            onChange={setType}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'expense', label: 'Despesas' },
              { value: 'income', label: 'Receitas' },
              { value: 'transfer', label: 'Transferências' },
            ]}
            className="w-max"
          />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_200px]">
          <label className="relative">
            <span className="sr-only">Buscar</span>
            <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={1.75} />
            <Input type="search" placeholder="Buscar pela descrição" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </label>
          <Select aria-label="Situação" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="">Pagos e pendentes</option>
            <option value="pending">Só pendentes</option>
            <option value="paid">Só pagos</option>
          </Select>
          <Select aria-label="Conta" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Todas as contas</option>
            {(accounts.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          {/* Sub-projeto 13 (T5): só aparece quando há alguma tag. */}
          {(tags.data ?? []).length > 0 && (
            <Select aria-label="Tag" value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">Todas as tags</option>
              {(tags.data ?? []).map((t) => (
                <option key={t.name} value={t.name}>
                  {`#${t.name}`}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      {transactions.isPending && <ListSkeleton rows={7} />}
      {transactions.isError && <ErrorState message={transactions.error.message} onRetry={() => transactions.refetch()} />}
      {transactions.isSuccess && items.length === 0 && (
        <EmptyState
          icon={<ArrowLeftRight className="h-7 w-7" strokeWidth={1.5} />}
          title={filtered ? 'Nada encontrado com esses filtros' : 'Nenhum lançamento neste mês'}
          description={filtered ? 'Tente outro mês ou limpe os filtros.' : 'Lance uma receita ou despesa para começar a ver o mês tomar forma.'}
          action={!filtered && <Button onClick={() => setEditing('new')}>Lançar agora</Button>}
        />
      )}
      {groups.length > 0 && (
        <div className="grid gap-6 [&>*]:min-w-0">
          {groups.map((g) => (
            <section key={g.date} aria-labelledby={`dia-${g.date}`}>
              <h2 id={`dia-${g.date}`} className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted first-letter:uppercase">
                {g.label}
              </h2>
              <Panel>
                <ul className="divide-y divide-border">
                  {g.items.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      account={accountById.get(tx.accountId)}
                      destination={tx.destinationAccountId ? accountById.get(tx.destinationAccountId) : undefined}
                      category={tx.categoryId ? categoryById.get(tx.categoryId) : undefined}
                      onEdit={() => setEditing(tx)}
                    />
                  ))}
                </ul>
              </Panel>
            </section>
          ))}
          {transactions.hasNextPage && (
            <Button variant="secondary" className="justify-self-center" loading={transactions.isFetchingNextPage} onClick={() => transactions.fetchNextPage()}>
              Carregar mais
            </Button>
          )}
        </div>
      )}

      {editing && (
        <TransactionForm
          open
          onOpenChange={(o) => !o && setEditing(null)}
          {...(editing === 'new' ? {} : { transaction: editing })}
        />
      )}
    </>
  );
}
