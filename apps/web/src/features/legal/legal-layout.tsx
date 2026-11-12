import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Panel } from '../../components/ui/panel';

export const CONTACT = 'botelhog45@gmail.com';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
      <div className="flex flex-col gap-3 text-[0.95rem] leading-relaxed text-muted [&_strong]:font-semibold [&_strong]:text-text">{children}</div>
    </section>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-primary">{children}</ul>;
}

const linkClass = 'text-text underline underline-offset-2 hover:text-primary';

export function MailLink() {
  return (
    <a href={`mailto:${CONTACT}`} className={linkClass}>
      {CONTACT}
    </a>
  );
}

export function DocLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={linkClass}>
      {children}
    </Link>
  );
}

/** Moldura das páginas públicas de documentos (privacidade, termos): fora do login, legível em 360 px. */
export function LegalPage({ title, meta, intro, children }: { title: string; meta: string; intro: ReactNode; children: ReactNode }) {
  return (
    <div className="aurora min-h-dvh">
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 md:px-8 md:py-16">
        <Link to="/entrar" className="inline-flex w-fit items-center gap-2 text-sm text-muted hover:text-text">
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Voltar para o FinControl
        </Link>
        <header className="flex flex-col gap-3">
          <p className="font-display text-lg tracking-tight">
            <span className="font-extralight">Fin</span>
            <span className="font-extrabold">Control</span>
          </p>
          <h1 className="font-display text-[clamp(2rem,5vw,3rem)] font-extrabold leading-tight tracking-[-0.02em]">{title}</h1>
          <p className="text-sm text-muted">{meta}</p>
        </header>

        <Panel className="flex flex-col gap-8 p-6 md:p-10">
          <p className="text-[0.95rem] leading-relaxed text-muted">{intro}</p>
          {children}
        </Panel>
      </main>
    </div>
  );
}
