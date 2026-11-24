import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { useSiteDemo } from './demo-context';
import { Reveal, RevealItem } from './reveal';

/** Chamada final (seção 3.10): o bloco limão grande com o botão da demo. */
export function FinalCta() {
  const demo = useSiteDemo();
  return (
    <section aria-labelledby="chamada-final-titulo" className="px-4 pb-20 md:px-10 md:pb-28">
      <Reveal className="brand-ring relative mx-auto max-w-7xl overflow-hidden rounded-[36px] bg-brand px-6 py-16 text-center text-brand-fg shadow-bar md:px-16 md:py-24">
        <RevealItem>
          <h2 id="chamada-final-titulo" className="mx-auto max-w-[16ch] font-display text-[clamp(2.4rem,7vw,5rem)] leading-[1.02] tracking-[-0.03em]">
            <span className="font-extralight">Comece agora,</span> <span className="font-extrabold">sem cadastro.</span>
          </h2>
        </RevealItem>
        <RevealItem>
          <p className="mx-auto mt-5 max-w-[46ch] text-base opacity-80 md:text-lg">
            Entre na demo com dados de exemplo e veja o seu mês organizado em um minuto.
          </p>
        </RevealItem>
        <RevealItem className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" variant="dark" onClick={() => void demo.start()} loading={demo.pending} className="max-sm:w-full">
            {!demo.pending && <Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
            Experimentar sem cadastro
          </Button>
          <Link
            to="/entrar?modo=cadastro"
            className="inline-flex h-14 items-center justify-center gap-2 rounded-full border border-brand-fg/25 px-7 text-base font-semibold transition-[background-color,transform] duration-200 hover:bg-brand-fg/5 active:scale-[0.98] max-sm:w-full"
          >
            Criar conta grátis
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </RevealItem>
        {demo.error && (
          <p role="alert" className="mx-auto mt-5 max-w-[46ch] rounded-[var(--radius-control)] bg-surface px-3.5 py-2.5 text-sm text-expense">
            {demo.error}
          </p>
        )}
      </Reveal>
    </section>
  );
}
