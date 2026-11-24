import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Briefcase, ShoppingCart, Sparkles, Utensils, Wallet, type LucideIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Field, Input } from '../../components/ui/field';
import { IconTile } from '../../components/ui/icon-tile';
import { Logo } from '../../components/ui/logo';
import { HeroAmount } from '../../components/ui/money';
import { Panel } from '../../components/ui/panel';
import { Segmented } from '../../components/ui/segmented';
import { PALETTE } from '../../lib/palette';
import { useAuth } from './auth-context';
import { translateAuthError } from './gateway';
import { useStartDemo } from './use-start-demo';

type Mode = 'entrar' | 'cadastro';

const emailField = z.email('Informe um e-mail válido.');
const passwordField = z.string().min(8, 'A senha precisa de pelo menos 8 caracteres.');
const signInSchema = z.object({ email: emailField, password: passwordField });
const signUpSchema = signInSchema.extend({ name: z.string().trim().min(2, 'Informe seu nome.') });
type FormValues = z.infer<typeof signUpSchema>;

/** Um lançamento de exemplo flutuando ao lado do cartão (só decoração da entrada). */
function FloatingChip({ icon, tint, name, amount, kind, className }: { icon: LucideIcon; tint: string; name: string; amount: string; kind: 'income' | 'expense'; className: string }) {
  return (
    <div className={`absolute flex items-center gap-2.5 rounded-2xl border border-border bg-surface py-2 pl-2 pr-3.5 shadow-bar ${className}`}>
      <IconTile icon={icon} color={tint} size="sm" />
      <div>
        <p className="text-xs font-semibold text-text">{name}</p>
        <p className={`tabular text-xs font-semibold ${kind === 'income' ? 'text-income' : 'text-expense'}`}>{amount}</p>
      </div>
    </div>
  );
}

/** A prévia colorida do app (sub-projeto 16, L10): o cartão limão do saldo com lançamentos em volta, feita em código. */
function AppPreview() {
  return (
    <div aria-hidden className="relative hidden max-w-md md:mt-4 md:block">
      <div className="brand-ring rounded-[var(--radius-card)] bg-brand p-7 text-brand-fg shadow-bar">
        <div className="flex items-start justify-between gap-3">
          <p className="pt-1 text-sm font-semibold">Saldo em todas as contas</p>
          <span className="relative grid h-12 w-12 place-items-center rounded-full bg-tangerine">
            <Wallet className="h-6 w-6 text-brand-fg" strokeWidth={2} />
            <span className="absolute -bottom-1 -left-2 h-4 w-4 rounded-full border-2 border-brand bg-grape" />
          </span>
        </div>
        <HeroAmount cents={1248050} className="mt-1 block text-5xl" />
        <div className="mt-6 flex h-14 items-end gap-2">
          {[38, 52, 44, 61, 57, 72].map((h, i) => (
            <span key={i} className="flex-1 rounded-t-md bg-brand-fg" style={{ height: `${h}%`, opacity: 0.18 + i * 0.12 }} />
          ))}
        </div>
      </div>
      <FloatingChip icon={ShoppingCart} tint={PALETTE.sky} name="Mercado" amount="− R$ 164,30" kind="expense" className="-right-12 -top-6 rotate-3" />
      <FloatingChip icon={Briefcase} tint={PALETTE.grape} name="Salário" amount="+ R$ 5.070,00" kind="income" className="-bottom-7 -left-6 -rotate-2" />
      <FloatingChip icon={Utensils} tint={PALETTE.tangerine} name="Restaurante" amount="− R$ 70,00" kind="expense" className="-right-16 bottom-16 -rotate-1" />
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}

/** Aviso de idade mínima e aceite. Aparece junto da demo e do formulário (no celular, a demo vem antes do painel). */
function AgeNotice({ className }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-muted ${className ?? ''}`}>
      Ao continuar, você declara ter 18 anos ou mais e concorda com os{' '}
      <Link to="/termos" className="underline hover:text-text">
        Termos de Uso
      </Link>{' '}
      e a{' '}
      <Link to="/privacidade" className="underline hover:text-text">
        Política de privacidade
      </Link>
      .
    </p>
  );
}

export function LoginPage() {
  const { gateway } = useAuth();
  const demo = useStartDemo();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get('modo') === 'cadastro' ? 'cadastro' : 'entrar');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  // O erro da demo aparece no mesmo aviso do formulário, como antes da extração do hook.
  const shownError = error ?? demo.error;
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const form = useForm<FormValues>({
    resolver: zodResolver(mode === 'cadastro' ? signUpSchema : (signInSchema as unknown as typeof signUpSchema)),
    defaultValues: { name: '', email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    setNotice(null);
    try {
      if (mode === 'entrar') {
        await gateway.signInWithPassword(values.email, values.password);
        // Uma demo que falhou antes não pode segurar o site na `/` para quem acabou de entrar (CodeRabbit, PR #39).
        demo.reset();
        navigate(from, { replace: true });
      } else {
        const { needsConfirmation } = await gateway.signUp(values.email, values.password, values.name);
        if (needsConfirmation) setNotice('Enviamos um link de confirmação para o seu e-mail. Depois de confirmar, é só entrar.');
        else {
          demo.reset();
          navigate('/', { replace: true });
        }
      }
    } catch (err) {
      setError(translateAuthError(err));
    }
  });

  function startDemo() {
    setError(null);
    setNotice(null);
    void demo.start();
  }

  async function forgotPassword() {
    demo.reset();
    const email = form.getValues('email');
    if (!emailField.safeParse(email).success) {
      form.setError('email', { message: 'Digite seu e-mail para receber o link de redefinição.' });
      return;
    }
    try {
      await gateway.resetPassword(email);
      setNotice('Se houver uma conta com esse e-mail, você vai receber um link para criar uma nova senha.');
    } catch (err) {
      setError(translateAuthError(err));
    }
  }

  return (
    <div className="relative isolate min-h-dvh overflow-hidden">
      {/* Brilhos coloridos de fundo (L3): limão, tangerina e uva, bem desfocados. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <span className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-brand/70 blur-3xl [html[data-theme=dark]_&]:bg-brand/20" />
        <span className="absolute -left-24 top-1/3 h-64 w-64 rounded-full bg-tangerine/25 blur-3xl" />
        <span className="absolute -bottom-20 right-1/4 h-64 w-64 rounded-full bg-grape/20 blur-3xl" />
      </div>
      <div className="mx-auto grid min-h-dvh max-w-7xl gap-12 px-5 py-10 md:grid-cols-[1.15fr_0.85fr] md:items-center md:px-10">
        <section className="flex flex-col gap-8">
          <Logo markClassName="h-11 w-11" tagline />
          <h1 className="font-display text-[clamp(2.6rem,6vw,4.5rem)] leading-[1.02] tracking-[-0.02em] [text-wrap:balance]">
            <span className="font-extralight">Seu dinheiro,</span>{' '}
            <span className="rounded-2xl bg-brand px-2 font-extrabold text-brand-fg [box-decoration-break:clone]">sob controle.</span>
          </h1>
          <p className="max-w-[46ch] text-base leading-relaxed text-muted">
            Saiba quanto entra, quanto sai e o que ainda vence no mês. Contas, recorrências e um painel que mostra para onde o
            seu dinheiro vai.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={startDemo} loading={demo.pending} disabled={demo.pending}>
              <Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Experimentar sem cadastro
            </Button>
            <Button size="lg" variant="secondary" onClick={() => formRef.current?.querySelector('input')?.focus()}>
              Já tenho conta
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </div>
          <AgeNotice className="-mt-4 max-w-[46ch]" />
          <AppPreview />
        </section>

        <div ref={formRef}>
          <Panel className="p-6 md:p-8">
            <Segmented
              label="Acesso"
              className="mb-6"
              value={mode}
              onChange={(m) => {
                setMode(m);
                setError(null);
                demo.reset();
                setNotice(null);
                form.clearErrors();
              }}
              options={[
                { value: 'entrar', label: 'Entrar' },
                { value: 'cadastro', label: 'Criar conta' },
              ]}
            />
            <form onSubmit={onSubmit} noValidate className="grid gap-4">
              {mode === 'cadastro' && (
                <Field label="Nome" error={errors.name?.message}>
                  <Input autoComplete="name" {...form.register('name')} />
                </Field>
              )}
              <Field label="E-mail" error={errors.email?.message}>
                <Input type="email" autoComplete="email" {...form.register('email')} />
              </Field>
              <Field label="Senha" error={errors.password?.message} hint={mode === 'cadastro' ? 'Mínimo de 8 caracteres.' : undefined}>
                <Input type="password" autoComplete={mode === 'cadastro' ? 'new-password' : 'current-password'} {...form.register('password')} />
              </Field>
              {shownError && (
                <p role="alert" className="rounded-[var(--radius-control)] bg-expense-soft px-3.5 py-2.5 text-sm text-expense">
                  {shownError}
                </p>
              )}
              {notice && (
                <p role="status" className="rounded-[var(--radius-control)] bg-primary-soft px-3.5 py-2.5 text-sm text-text">
                  {notice}
                </p>
              )}
              <Button type="submit" size="lg" loading={isSubmitting} className="mt-1 w-full">
                {mode === 'entrar' ? 'Entrar' : 'Criar conta'}
              </Button>
            </form>
            <div className="my-5 flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-border" />
              ou
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button variant="secondary" size="lg" className="w-full" onClick={() => gateway.signInWithGoogle().catch((e) => setError(translateAuthError(e)))}>
              <GoogleMark />
              Continuar com Google
            </Button>
            {mode === 'entrar' && (
              <button type="button" onClick={forgotPassword} className="mt-4 text-sm text-muted underline hover:text-text">
                Esqueci a senha
              </button>
            )}
          </Panel>
          <AgeNotice className="mt-4 text-center" />
        </div>
      </div>
    </div>
  );
}
