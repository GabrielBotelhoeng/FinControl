import { LazyMotion, MotionConfig } from 'motion/react';
import { startTransition, useEffect, useState } from 'react';
import { useHydrated } from '../../lib/hydration';
import { PUBLIC_HEAD, usePublicHead } from '../../lib/public-head';
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

const loadMotionFeatures = () => import('./motion-features').then((m) => m.default);

/** O que vem depois do herói, na ordem da página. */
const REST_OF_PAGE = [HowItWorks, Features, MobileApp, PrivacyBlock, Pricing, Faq, FinalCta, SiteFooter];

/**
 * O primeiro quadro só tem o cabeçalho, o herói e a faixa (o LCP é a captura do herói). As outras seções entram logo
 * depois, uma por quadro, cada uma numa transição do React: são commits pequenos em vez de uma tarefa longa
 * (Lighthouse no celular). Chegando por uma âncora (ex.: `/#planos`), a página inteira já vem no primeiro quadro, e
 * também no HTML estático do build e na hidratação dele (sub-projeto 18, E1): os robôs leem a página toda.
 */
function useSectionsShown() {
  const hydrated = useHydrated();
  const [shown, setShown] = useState(() => (!hydrated || window.location.hash.length > 1 ? REST_OF_PAGE.length : 0));
  useEffect(() => {
    if (shown >= REST_OF_PAGE.length) return;
    const frame = requestAnimationFrame(() => startTransition(() => setShown((n) => n + 1)));
    return () => cancelAnimationFrame(frame);
  }, [shown]);
  return shown;
}

export const SITE_TITLE = PUBLIC_HEAD['/'].title;

/**
 * Site de apresentação (sub-projeto 17): a `/` para quem ainda não tem sessão. Sempre claro (`site-root` fixa os
 * tokens do tema claro, S14), com o Motion só neste pedaço do bundle (S3) e respeitando o `prefers-reduced-motion` (S4).
 */
export default function SitePage() {
  const sectionsShown = useSectionsShown();
  usePublicHead('/');

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadMotionFeatures} strict>
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
              {REST_OF_PAGE.slice(0, sectionsShown)
                .filter((Section) => Section !== SiteFooter)
                .map((Section, i) => (
                  // A ordem é fixa: a posição serve de chave (o nome da função muda na minificação).
                  <Section key={i} />
                ))}
            </main>
            {sectionsShown === REST_OF_PAGE.length && <SiteFooter />}
          </div>
        </SiteDemoProvider>
      </LazyMotion>
    </MotionConfig>
  );
}
