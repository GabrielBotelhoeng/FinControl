/** Mostrada quando o build não tem as variáveis de ambiente obrigatórias, em vez de uma tela em branco. */
export function ConfigErrorScreen({ fields }: { fields: string[] }) {
  return (
    <main className="aurora flex min-h-dvh items-center justify-center px-4">
      <div className="flex max-w-md flex-col gap-4 rounded-[var(--radius-panel)] border border-border bg-surface p-8 shadow-panel">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">O FinControl não está configurado</h1>
        <p className="text-sm leading-relaxed text-muted">
          Este build foi gerado sem algumas variáveis de ambiente obrigatórias. Defina-as no projeto (veja{' '}
          <code className="text-text">apps/web/.env.example</code>) e gere o build de novo:
        </p>
        <ul className="flex flex-col gap-1.5">
          {fields.map((field) => (
            <li key={field}>
              <code className="rounded bg-primary-soft px-2 py-1 text-sm text-text">{field}</code>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
