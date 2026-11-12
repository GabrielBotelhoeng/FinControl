import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Field, Input } from '../../components/ui/field';
import { HeroAmount } from '../../components/ui/money';
import { Panel } from '../../components/ui/panel';
import { Segmented } from '../../components/ui/segmented';
import artLarge from '../../assets/login-art-1920.webp';
import artSmall from '../../assets/login-art-960.webp';
import { useApi } from '../../lib/api-context';
import { useAuth } from './auth-context';
import { translateAuthError } from './gateway';

type Mode = 'entrar' | 'cadastro';

const emailField = z.email('Informe um e-mail válido.');
const passwordField = z.string().min(8, 'A senha precisa de pelo menos 8 caracteres.');
const signInSchema = z.object({ email: emailField, password: passwordField });
const signUpSchema = signInSchema.extend({ name: z.string().trim().min(2, 'Informe seu nome.') });
type FormValues = z.infer<typeof signUpSchema>;

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}

export function LoginPage() {
  const { gateway } = useAuth();
  const api = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get('modo') === 'cadastro' ? 'cadastro' : 'entrar');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [demoPending, setDemoPending] = useState(false);
  const demoLock = useRef(false);
  const formRef = useRef<HTMLDivElement>(null);
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
        navigate(from, { replace: true });
      } else {
        const { needsConfirmation } = await gateway.signUp(values.email, values.password, values.name);
        if (needsConfirmation) setNotice('Enviamos um link de confirmação para o seu e-mail. Depois de confirmar, é só entrar.');
        else navigate('/', { replace: true });
      }
    } catch (err) {
      setError(translateAuthError(err));
    }
  });

  async function startDemo() {
    if (demoLock.current) return;
    demoLock.current = true;
    setDemoPending(true);
    setError(null);
    try {
      // Nova tentativa depois de uma falha no seed: reaproveita o anônimo que já existe em vez de criar outro.
      if (!(await gateway.getSession())?.user.isAnonymous) await gateway.signInAnonymously();
      await api.post('/demo/seed', undefined);
      navigate('/', { replace: true });
    } catch (err) {
      setError(translateAuthError(err));
      demoLock.current = false;
      setDemoPending(false);
    }
  }

  async function forgotPassword() {
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
    <div className="aurora relative min-h-dvh overflow-hidden">
      <img
        src={artLarge}
        srcSet={`${artSmall} 960w, ${artLarge} 1920w`}
        sizes="100vw"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover object-right opacity-30 md:opacity-70 [mask-image:linear-gradient(to_right,transparent_10%,black_60%)] [html[data-theme=light]_&]:opacity-25"
      />
      <div className="mx-auto grid min-h-dvh max-w-7xl gap-12 px-5 py-10 md:grid-cols-[1.15fr_0.85fr] md:items-center md:px-10">
        <section className="flex flex-col gap-8">
          <p className="font-display text-lg tracking-tight">
            <span className="font-extralight">Fin</span>
            <span className="font-extrabold">Control</span>
          </p>
          <h1 className="font-display text-[clamp(2.6rem,6vw,4.5rem)] leading-[0.95] tracking-[-0.02em] [text-wrap:balance]">
            <span className="font-extralight">Seu dinheiro,</span> <span className="font-extrabold">sob controle.</span>
          </h1>
          <p className="max-w-[46ch] text-base leading-relaxed text-muted">
            Saiba quanto entra, quanto sai e o que ainda vence no mês. Contas, recorrências e um painel que mostra para onde o
            seu dinheiro vai.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={startDemo} loading={demoPending} disabled={demoPending}>
              <Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Experimentar sem cadastro
            </Button>
            <Button size="lg" variant="secondary" onClick={() => formRef.current?.querySelector('input')?.focus()}>
              Já tenho conta
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </div>
          <div aria-hidden className="hidden max-w-md rounded-[var(--radius-panel)] border border-border bg-surface/60 p-6 shadow-panel md:block">
            <p className="text-sm text-muted">Saldo em todas as contas</p>
            <HeroAmount cents={1248050} className="mt-2 block text-5xl" />
            <div className="mt-6 flex h-16 items-end gap-2">
              {[38, 52, 44, 61, 57, 72].map((h, i) => (
                <span key={i} className="flex-1 rounded-t-md bg-primary/70" style={{ height: `${h}%`, opacity: 0.45 + i * 0.1 }} />
              ))}
            </div>
          </div>
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
              {error && (
                <p role="alert" className="rounded-[var(--radius-control)] bg-expense-soft px-3.5 py-2.5 text-sm text-expense">
                  {error}
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
          <Link to="/privacidade" className="mt-4 block text-center text-xs text-muted underline hover:text-text">
            Política de privacidade
          </Link>
        </div>
      </div>
    </div>
  );
}
