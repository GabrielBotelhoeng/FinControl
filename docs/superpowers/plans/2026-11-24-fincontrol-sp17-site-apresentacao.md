# Plano — Sub-projeto 17: site de apresentação

_Spec: `docs/superpowers/specs/2026-11-24-fincontrol-sp17-site-apresentacao-design.md` (S1–S14). Branch `feat/site-apresentacao` (floor "SP17 Site"). Executor: Frontend. Um commit por tarefa, Conventional Commits em português._

**Regras:** trabalhar só no worktree do floor (`C:\Users\botel\OneDrive\Desktop\.maestri\floors\fincontrol--featsite-apresentacao`); nada de API, banco ou migration; seguir o `DESIGN.md`; usar as skills de front e de animação do projeto (`frontend-design`, `design-taste-frontend`, `emil-design-eng`, `animate`, `choreograph`, `animation-performance`, `review-animations`) e o MCP `context7` para a API do Motion. Antes de cada commit: `npm run lint`, `npm run typecheck` e `npm test -w @fincontrol/web`.

## T1 — Hook da demo e portão da `/`

- Extrair `startDemo` de `login-page.tsx` para `src/features/auth/use-start-demo.ts` (`{ start, pending, error }`), com a mesma trava contra clique duplo e o mesmo reaproveitamento do anônimo. A entrada passa a usar o hook, e os testes dela continuam passando sem mudança de comportamento.
- `src/app/home-gate.tsx`: carregando → o mesmo esqueleto do `RequireAuth`; com sessão → `<AppShell />` (as rotas filhas continuam iguais); sem sessão em `/` → `<SitePage />` em `lazy`; sem sessão e `matchMedia('(display-mode: standalone)')` → `<Navigate to="/entrar" />` (S2); sem sessão em qualquer outra rota filha → o mesmo redirecionamento do `RequireAuth` (com `state.from`).
- Testes (Testing Library): sem sessão em `/` aparece o `h1` do site; com sessão, o painel; sem sessão em `/lancamentos`, a entrada; sem sessão em standalone, a entrada; o hook da demo chama `signInAnonymously` e `/demo/seed` uma vez só.
- Commit: `feat(web): portão da página inicial e hook da demo (sub-projeto 17)`.

## T2 — Motion e base do site

- `npm i motion -w @fincontrol/web`.
- `src/features/site/site-page.tsx` com `MotionConfig reducedMotion="user"`, `header`/`main`/`footer`, `document.title`, e as seções com os `id` das âncoras (`recursos`, `planos`, `perguntas`).
- `site-header.tsx` (fixo; sombra depois de 8 px de scroll) e `site-footer.tsx`.
- `src/features/site/reveal.tsx`: o componente de revelar com `whileInView` (uma vez, 20%, sobe 24 px) e a sequência dos filhos, para todas as seções usarem.
- Commit: `feat(web): base do site de apresentação com Motion`.

## T3 — Herói, molduras e faixa

- `device-frame.tsx`: `PhoneFrame` e `LaptopFrame` em CSS (bordas arredondadas, câmera, sombra suave), recebendo `src`, `alt`, `width` e `height` (sem layout shift; `fetchPriority="high"` só na captura do herói, `loading="lazy"` nas outras).
- `hero.tsx` (seção 3.2 da spec), com o contador do saldo (`useMotionValue` + `animate`; em reduced-motion já mostra o valor final), os cartões flutuando e o paralaxe. O `h1` e o botão principal visíveis desde o primeiro quadro (S4).
- `marquee.tsx` (seção 3.3, S12): duas cópias em fila, a segunda `aria-hidden`, animação em CSS no `index.css` (`@keyframes site-marquee`), pausada no hover e no `prefers-reduced-motion`.
- Enquanto as capturas (T6) não existem, usar um placeholder colorido com a mesma proporção.
- Commit: `feat(web): herói, molduras de aparelho e faixa rolante do site`.

## T4 — Como funciona, recursos, no celular e seus dados

- `how-it-works.tsx`, `features.tsx` (no computador, a coluna da tela fica `sticky` e troca conforme o recurso em vista, com `useInView` em cada bloco de texto; no celular, cartões com a captura), `mobile-app.tsx` e `privacy-block.tsx` (com `IconTile` e links para `/privacidade` e `/termos`).
- Commit: `feat(web): seções de recursos, app no celular e dados do site`.

## T5 — Planos, perguntas e chamada final

- `pricing.ts`: `PLANS` com `id`, `name`, `monthlyCents`, `yearlyCents`, `features`, `highlight`, mais `PRICES_ARE_PROVISIONAL = true` (S6 e S8). Valores em centavos, formatados com o utilitário de dinheiro que o app já usa.
- `pricing.tsx`: a chave Mensal/Anual (`role="radiogroup"` ou o `Segmented` existente, com o indicador em `layoutId`), os cartões, o preço animando, o selo "Preços de lançamento, provisórios" e "Hoje todos os recursos estão liberados de graça". Os botões chamam o hook da demo.
- `faq.tsx`: acordeão com `button` + `aria-expanded` + `aria-controls`, abrindo com altura animada (`grid-template-rows` ou `motion`), e as perguntas da seção 3.9 exportadas para o JSON-LD.
- `final-cta.tsx`.
- Testes: os preços vêm de `pricing.ts`; a chave troca mensal ↔ anual; o selo aparece; o acordeão abre e fecha pelo teclado; o botão da demo do site chama o hook.
- Commit: `feat(web): planos com preços provisórios, perguntas e chamada final do site`.

## T6 — Capturas reais da demo

- `e2e/tests/site-capturas.spec.ts`, no molde de `screenshots.spec.ts` (`test.skip(!process.env.SITE_CAPTURES)`): entra na demo e captura Painel, Lançamentos, Faturas, Plano de quitação, Relatórios e Assistente a 390×844 (`deviceScaleFactor: 2`) e Painel e Relatórios a 1440×900, em PNG numa pasta temporária.
- Converter para WebP com `sharp` (já é dependência de desenvolvimento da web), num script `apps/web/scripts/site-images.mjs`, para `apps/web/public/site/` (qualidade 80, largura máxima 780 px no celular e 1440 px no computador). Gerar também o `public/og-image.png` (1200×630): fundo `#F5F6F0`, o logo, o título e a captura do painel num celular, composto pelo `sharp` (sem IA).
- Trocar os placeholders pelas imagens, com `alt` descritivo.
- Commit: `feat(web): capturas reais da demo no site e imagem de compartilhamento`.

## T7 — SEO e PWA

- `index.html`: título "FinControl — controle financeiro pessoal no celular e no computador", descrição, `link rel="canonical"` (https://fincontrol-gb.vercel.app/), Open Graph (`og:type`, `og:locale` pt_BR, `og:title`, `og:description`, `og:url`, `og:image` com largura e altura), Twitter Card `summary_large_image` e o JSON-LD inline (`<script type="application/ld+json">`: é bloco de dados, não é executado, então a CSP `script-src 'self'` não o bloqueia; conferir no console do portal que não há aviso de CSP) com `SoftwareApplication` (`applicationCategory` FinanceApplication, `operatingSystem` "Web, Android, iOS", `offers` iguais a `pricing.ts`) e `FAQPage`.
- `public/robots.txt` (permite tudo e aponta o sitemap) e `public/sitemap.xml`.
- `vite.config.ts`: `globIgnores: ['site/**', 'og-image.png']` no workbox (S10).
- Teste: ler o `index.html` e conferir as tags principais e que o JSON-LD é JSON válido com os mesmos preços de `pricing.ts`.
- Commit: `feat(web): SEO do site, robots, sitemap e imagens fora do cache do app`.

## T8 — E2E e ajustes

- `e2e/tests/site.spec.ts`: sem sessão `/` mostra o site; sem rolagem horizontal a 360, 390 e 1440 px (rolando a página inteira para disparar as revelações); "Experimentar sem cadastro" do herói abre o painel da demo; com `emulateMedia({ reducedMotion: 'reduce' })` todo o conteúdo fica visível; a chave dos planos troca o preço.
- Conferir os testes existentes que iam a `/` sem sessão esperando `/entrar` e ajustar para o comportamento novo.
- Rodar `npm run test:e2e` inteiro.
- Commit: `test(e2e): site de apresentação no celular e no computador`.

## T9 — Docs

- `docs/HANDOFF.md`: seção do sub-projeto 17 (o que foi entregue, decisões, testes). `README.md`: citar o site.
- Commit: `docs: registra o sub-projeto 17 no HANDOFF`.

## Depois do Frontend (Orquestrador)

1. Reviewer (OpenCode, só leitura) revisa a branch contra a spec; Antigravity só se houver dúvida de UX ou de animação.
2. QA: lint, typecheck, testes, E2E e as telas a 1440 e 360–390 px nos portais apontados para o servidor do floor, com capturas como evidência; `prefers-reduced-motion`.
3. PR, prévia da Vercel, CodeRabbit, correções pertinentes, Lighthouse no celular na prévia.
4. Parar e pedir a aprovação do usuário para o merge e o deploy.
