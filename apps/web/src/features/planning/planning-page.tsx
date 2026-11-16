import { useSearchParams } from 'react-router';
import { PageHeader } from '../../components/ui/page-header';
import { cn } from '../../lib/cn';
import { BudgetTab } from './budget-tab';
import { GoalsTab } from './goals-tab';

type Tab = 'orcamento' | 'metas';
const TABS: { value: Tab; label: string }[] = [
  { value: 'orcamento', label: 'Orçamento' },
  { value: 'metas', label: 'Metas' },
];

/** Planejamento (sub-projeto 3): abas Orçamento e Metas, com a aba na URL (`?aba=metas`). */
export default function PlanningPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('aba') === 'metas' ? 'metas' : 'orcamento';

  return (
    <>
      <PageHeader light="Seu" bold="planejamento" description="Quanto gastar em cada categoria e quanto guardar para cada objetivo." />
      <div role="tablist" aria-label="Planejamento" className="mb-6 inline-flex rounded-full border border-border bg-surface-2 p-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            className={cn('rounded-full px-4 py-1.5 text-sm font-medium', tab === t.value ? 'bg-surface text-text shadow-sm' : 'text-muted')}
            onClick={() => setParams(t.value === 'metas' ? { aba: 'metas' } : {})}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'orcamento' ? <BudgetTab /> : <GoalsTab />}
    </>
  );
}
