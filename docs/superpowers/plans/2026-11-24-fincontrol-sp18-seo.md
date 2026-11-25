# Plano — Sub-projeto 18: SEO do site

_Spec: `docs/superpowers/specs/2026-11-24-fincontrol-sp18-seo-design.md` (E1–E12). Branch `feat/seo-site` (floor "SP18 SEO", base main cbb7ad5). Executor: Frontend. Um commit por tarefa, Conventional Commits em português._

**Regras:** trabalhar só no worktree do floor (`C:\Users\botel\OneDrive\Desktop\.maestri\floors\fincontrol--featseo-site`); nada de API, banco ou migration; sem push (é do DevOps). Antes de cada commit: `npm run lint`, `npm run typecheck` e `npm test -w @fincontrol/web`. Usar o `context7` para a API do `react-dom/static`, do Vite (build SSR), do `@supabase/auth-js` e do `vite-plugin-pwa`. Dev server do floor numa porta livre (5174), se precisar.

## T1 — JSON-LD sem preço pago e sitemap (E7, E8)

- O JSON-LD da home fica só com a oferta Grátis (R$ 0). O `seo.test.ts` passa a conferir que nenhuma oferta tem preço maior que zero.
- `public/sitemap.xml` sem a `/entrar`.
- Commit: `fix(web): JSON-LD sem os preços provisórios e sitemap só com as páginas públicas (sub-projeto 18)`.

## T2 — Cliente de login só com o auth-js (E9)

- Trocar `@supabase/supabase-js` por `@supabase/auth-js` em `app/providers.tsx` e `features/auth/gateway.ts` (e nos tipos `Session`, `User` etc.). Manter **a mesma chave** `sb-<ref>-auth-token` (montada a partir de `VITE_SUPABASE_URL`, como o supabase-js faz), `persistSession`, `autoRefreshToken`, `detectSessionInUrl` e o `flowType` atuais, e os cabeçalhos `apikey`/`Authorization` que o supabase-js mandava para o Auth.
- Teste: a chave do `localStorage` é a mesma de antes (comparar com a que o supabase-js gerava para a mesma URL). O E2E de login, de cadastro, da demo e de excluir conta precisa continuar passando (o login falso do E2E, `e2e/fake-auth.ts`, pode precisar de ajuste).
- Remover o `@supabase/supabase-js` do `package.json` da web, se nada mais usar.
- Commit: `perf(web): login com o auth-js no lugar do supabase-js inteiro (mesma sessão)`.

## T3 — zod fora do caminho inicial (E10)

- Nos módulos do caminho inicial (o portão, o site, o tema, `lib/format.ts` e o que eles importam), trocar o barrel `@fincontrol/shared` por imports dos arquivos usados (subcaminhos; ajustar o `exports` do `packages/shared/package.json` se precisar, sem quebrar a API).
- Conferir no build que o zod não está mais no pedaço de entrada nem no do site.
- Commit: `perf(web): o caminho inicial importa do shared só o que usa, sem o zod`.

## T4 — Prerender das páginas públicas (E1, E3, E4, E6)

- `src/prerender.tsx`: renderiza `/`, `/privacidade` e `/termos` com os mesmos providers que essas páginas precisam (sem tocar em `window`/`localStorage` no servidor).
- `scripts/prerender.mjs` (chamado pelo `build` da web depois do `vite build`): build SSR da entrada, render de cada rota, e escrita de `dist/index.html`, `dist/privacidade/index.html` e `dist/termos/index.html`, com o conteúdo no `#root` (`data-prerendered-route`) e a cabeça própria de cada rota (E6, tabela num arquivo só, também usada no cliente ao navegar). O JSON-LD só na home.
- `dist/app.html` (casca vazia com `noindex`) e `dist/404.html` (página "não encontrada" gerada, com `noindex` e link para o início).
- `public/theme-init.js`: a decisão do E3 (`data-boot="app"` quando o HTML estático não vale) e um `<style>` no `index.html` que esconde o conteúdo gerado nesse caso.
- `main.tsx`: `hydrateRoot` quando o HTML estático vale, `createRoot` quando não.
- `Reveal` e as seções (E4): visíveis no servidor e na hidratação; depois, só o que está abaixo da dobra se esconde e anima ao entrar na tela. Conferir que não há erro de hidratação.
- Testes: o HTML gerado de cada rota tem o `h1`, a cabeça própria e (só na home) o JSON-LD; o `theme-init` marca `data-boot="app"` com sessão guardada, no app instalado, no retorno de login e fora das rotas geradas.
- Commit: `feat(web): HTML estático das páginas públicas, casca do app e página 404 (sub-projeto 18)`.

## T5 — Vercel e PWA (E5, seção 3 da spec)

- `vercel.json`: rewrites só das rotas do app para `/app.html` (lista na spec), sem o `/(.*)`. Os cabeçalhos de segurança continuam valendo para tudo.
- Teste: as rotas do `router.tsx` (menos as públicas) estão todas nos rewrites, e nenhuma rota pública está.
- Workbox: `navigateFallback: '/app.html'`, `navigateFallbackDenylist` com `/`, `/privacidade`, `/termos` e `/api/`.
- Commit: `feat(web): 404 de verdade na Vercel e o app instalado abrindo a casca do app`.

## T6 — E2E, medições e docs

- E2E: `site.spec` e os demais ajustados ao HTML gerado (o E2E usa o build: conferir a `/` sem sessão, a hidratação sem erro no console, a `/` com sessão sem o site em nenhum quadro, o `/entrar` e uma rota privada abrindo).
- Lighthouse no celular (mediana de 3, `lighthouse@12 --form-factor=mobile`, build servido localmente): meta ≥ 90. Medir o JS do app logado contra a base cbb7ad5.
- `docs/HANDOFF.md`: seção do sub-projeto 18.
- Commits: `test(e2e): páginas públicas geradas no build` e `docs: registra o sub-projeto 18 no HANDOFF`.

## Depois do Frontend (Orquestrador)

1. Reviewer (só leitura) contra a spec; foco em E3 (sem piscar), E9 (mesma sessão) e E5 (nenhuma rota do app virando 404).
2. QA: lint, typecheck, testes, E2E; `curl` do HTML cru de cada rota pública (h1 e metas), `/nao-existe` com 404 e as privadas com `noindex` (no build local e, pelo DevOps, na prévia da Vercel com o CLI autenticado); Lighthouse; telas 1440/390/360.
3. DevOps: push, PR, CI e CodeRabbit. Parar antes do merge e avisar o Maestro com os links.
