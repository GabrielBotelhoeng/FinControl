import { domMax, LazyMotion, MotionConfig } from 'motion/react';
import { useEffect } from 'react';
import { SiteDemoProvider } from './demo-context';
import { Faq } from './faq';
import { Features } from './features';
import { FinalCta } from './final-cta';
import { Hero } from './hero';
import { HowItWorks } from './how-it-works';
import { Marquee } from './marquee';
import { MobileApp } from './mobile-app';
import { Pricing } from './plans';
import { PrivacyBlock } from './privacy-block';
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
              <Hero />
              <Marquee />
              <HowItWorks />
              <Features />
              <MobileApp />
              <PrivacyBlock />
              <Pricing />
              <Faq />
              <FinalCta />
            </main>
            <SiteFooter />
          </div>
        </SiteDemoProvider>
      </LazyMotion>
    </MotionConfig>
  );
}
