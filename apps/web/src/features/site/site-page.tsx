import { domMax, LazyMotion, MotionConfig } from 'motion/react';
import { useEffect } from 'react';
import { SiteDemoProvider } from './demo-context';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

export const SITE_TITLE = 'FinControl — controle financeiro pessoal no celular e no computador';

/**
 * Site de apresentação (sub-projeto 17): a `/` para quem ainda não tem sessão. Sempre claro (`site-root` fixa os
 * tokens do tema claro, S14), com o Motion só neste pedaço do bundle (S3) e respeitando o `prefers-reduced-motion` (S4).
 */
export default function SitePage() {
  useEffect(() => {
    const previous = document.title;
    document.title = SITE_TITLE;
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domMax} strict>
        <SiteDemoProvider>
          <div id="topo" className="site-root min-h-dvh bg-background text-text">
            <a
              href="#conteudo"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2"
            >
              Pular para o conteúdo
            </a>
            <SiteHeader />
            <main id="conteudo" className="overflow-x-clip">
              <section className="px-4 pt-28 md:px-10">
                <h1 className="font-display">
                  <span className="font-extralight">Seu dinheiro,</span> <span className="font-extrabold">sob controle.</span>
                </h1>
              </section>
              <section id="recursos" aria-label="Recursos" />
              <section id="planos" aria-label="Planos" />
              <section id="perguntas" aria-label="Perguntas" />
            </main>
            <SiteFooter />
          </div>
        </SiteDemoProvider>
      </LazyMotion>
    </MotionConfig>
  );
}
