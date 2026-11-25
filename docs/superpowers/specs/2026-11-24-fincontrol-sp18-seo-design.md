# Sub-projeto 18: SEO do site — design

_2026-11-24 · Orquestrador (Modo Maestro) · branch `feat/seo-site` · base `main` cbb7ad5 (sub-projeto 17 no ar). Continua a S14 da spec do sub-projeto 17, que deixou o HTML pré-renderizado para depois._

## 1. Objetivo

Corrigir os problemas de SEO que o Maestro achou na auditoria do site em produção (sub-projeto 17):

1. O HTML inicial é vazio (`<div id="root"></div>`). Robôs que não rodam JavaScript (Bing em parte, GPTBot, ClaudeBot, PerplexityBot) veem uma página em branco.
2. `/privacidade` e `/termos` têm o mesmo título, a mesma descrição e o mesmo canonical da home (o canonical aponta para `/`).
3. Soft 404: `/nao-existe` e as rotas privadas respondem 200.
4. O JSON-LD publica os preços provisórios (9,90 e 99).
5. Desempenho no celular em 85 no Lighthouse, no limite da meta.

## 2. Decisões (E1–E12)

| # | Decisão | Motivo |
|---|---|---|
| E1 | **HTML estático gerado no build (prerender)** das três rotas públicas: `/` (`dist/index.html`), `/privacidade` (`dist/privacidade/index.html`) e `/termos` (`dist/termos/index.html`). Um script de Node roda depois do `vite build`: faz um build SSR de uma entrada própria (`src/prerender.tsx`) e renderiza cada rota com `react-dom/static` (`prerender`) ou `renderToString`, dentro do `index.html` gerado pelo Vite. O resto continua SPA. | Os robôs sem JS passam a ler o título, o texto e os links. Mudar para o modo framework do React Router (SSR de verdade) ou para Astro seria trocar a arquitetura; o prerender no build não muda o deploy (continua estático na Vercel) e não tem custo. |
| E2 | **Uma casca vazia para o app**, `dist/app.html`, com `<meta name="robots" content="noindex">`. A `/entrar` e as rotas privadas são servidas por ela (E5). | Cada tipo de página leva o HTML certo: as públicas com conteúdo e indexáveis; o app sem o HTML do site (sem bytes à toa) e fora do índice. |
| E3 | **Sem piscar:** o `public/theme-init.js` (que roda antes da pintura) decide se o HTML estático vale. Ele vale só quando o caminho é o da página gerada (`data-prerendered-route` no `#root`) e, na `/`, quando não há sessão guardada, não é o app instalado e não há retorno de login na URL (as regras do `home-gate.tsx`, a mesma lista `AUTH_RETURN_PARAMS`). Se não valer, ele marca `<html data-boot="app">`, e um `<style>` no `<head>` esconde o conteúdo gerado; o `main.tsx` então usa `createRoot` (render do zero). Se valer, o `main.tsx` usa `hydrateRoot`. | Mantém a regra do SP17 (com sessão, o painel; no app instalado, a entrada) sem que a pessoa logada veja o site por um instante. O `<style>` embutido é permitido pela CSP (`style-src 'unsafe-inline'`); script embutido continua proibido. |
| E4 | **Animações com o HTML estático:** o que vem do servidor aparece visível. Depois da hidratação, só o que está abaixo da dobra é escondido e entra com a animação ao aparecer na tela (o `Reveal` decide no `useLayoutEffect`, antes da pintura). O que já está na tela não se mexe. Com `prefers-reduced-motion`, nada se esconde. | Sem texto escondido para os robôs (`opacity: 0` no HTML) e sem diferença entre servidor e cliente na hidratação. Como o que se esconde está fora da tela, a pessoa não vê nada sumir. |
| E5 | **404 de verdade na Vercel.** O `vercel.json` troca o `/(.*) → /index.html` por rewrites só das rotas do app (`/entrar`, `/lancamentos`, `/importar`, `/contas`, `/cartoes/:id`, `/emprestimos`, `/emprestimos/:id`, `/dividas`, `/dividas/plano`, `/dividas/:id`, `/patrimonio`, `/calendario`, `/planejamento`, `/relatorios`, `/resumo`, `/notificacoes`, `/assistente`, `/categorias`, `/perfil`) para `/app.html`. As públicas saem dos arquivos gerados (a Vercel serve o arquivo antes dos rewrites), e o resto cai no `dist/404.html` (gerado, com `noindex` e um link para o início), que a Vercel serve com status 404. **Um teste compara as rotas do `router.tsx` com os rewrites**, para uma rota nova não virar 404 por esquecimento. | Rota inexistente passa a ser 404 real. As privadas continuam 200 (o app precisa abrir nelas), mas com `noindex` (E2). |
| E6 | **Cabeça própria de cada rota pública**, já no HTML gerado: `title`, `description`, `link rel=canonical`, `og:url`, `og:title` e `og:description`. Home: os atuais; Privacidade: "Política de Privacidade — FinControl"; Termos: "Termos de Uso — FinControl", com descrições próprias. O JSON-LD só na home. No cliente, a mesma tabela atualiza a cabeça ao navegar entre as públicas. | Cada página passa a ser um resultado próprio no Google, e o canonical deixa de juntar tudo na home. |
| E7 | **`noindex`** na casca do app (a `/entrar` e as privadas) e no `404.html`. O `sitemap.xml` fica só com `/`, `/privacidade` e `/termos`. O `robots.txt` continua liberando tudo (um `Disallow` impediria o robô de ler o `noindex`). | Pedido do Maestro. |
| E8 | **JSON-LD sem as ofertas pagas:** fica só a oferta Grátis (R$ 0) até o usuário definir os preços. A página continua mostrando os preços com o selo de provisório. O teste do SEO passa a conferir que o JSON-LD não tem preço maior que zero. | Não publicar como dado estruturado um preço que ainda não existe. |
| E9 | **Cliente de login mais leve:** trocar o `@supabase/supabase-js` pelo `@supabase/auth-js` (o app usa o Supabase só para o login: `app/providers.tsx` e `features/auth/gateway.ts`). **Atenção:** a chave da sessão no `localStorage` tem de continuar a mesma (`sb-ojywswdjhjmwnfhalntl-auth-token`, que o supabase-js monta a partir do endereço do projeto), assim como `detectSessionInUrl`, `persistSession`, `autoRefreshToken` e o `flowType`. Se a chave mudar, **todo mundo que está logado é deslogado**. Um teste confere a chave. | Uns 50 KB gzip a menos no caminho inicial (storage, postgrest e realtime não são usados). |
| E10 | **zod fora do caminho inicial:** o `lib/format.ts` importa do barrel `@fincontrol/shared`, que puxa os schemas. Trocar por imports dos arquivos (subcaminhos) só do que é usado, nos módulos do caminho inicial (portão, site, tema, formatação), sem mexer nos formulários. | O site não valida nada no primeiro carregamento. |
| E11 | **Meta de desempenho: ≥ 90** no Lighthouse do celular (mediana de 3, mesmo comando do SP17, no build de produção servido localmente, porque a prévia pede o login da Vercel), sem piorar a acessibilidade (≥ 95), o SEO (100) nem o JS do app logado (≤ base). | Pedido do Maestro: subir com folga. |
| E12 | **Fora do escopo** (registrados como próximos): Search Console (depende do login do usuário), domínio próprio (custo), páginas de conteúdo e ferramentas grátis, e a atualização do PWA com aviso de nova versão (vira o sub-projeto 19). | Pedido do Maestro. |

## 3. PWA

- O `navigateFallback` do Workbox passa a ser `/app.html` (o app instalado abre a casca do app), com `navigateFallbackDenylist` para `/`, `/privacidade`, `/termos` e `/api/`. `app.html` entra no precache.
- O `start_url` continua `/` (no app instalado, o E3 marca `data-boot="app"`).

## 4. Critérios de aceite

1. `curl` do HTML cru de `/`, `/privacidade` e `/termos` mostra o `h1` certo, o texto da página, e `title`, `description`, `canonical` e `og:url` próprios. Só a `/` tem o JSON-LD, e ele não tem preço maior que zero.
2. `/nao-existe` responde **404** com o HTML do `404.html` (com `noindex`). `/lancamentos` e `/entrar` respondem 200 com a casca `noindex`.
3. Sem sessão, a `/` hidrata sem erro de hidratação no console. Com sessão guardada, no app instalado e no retorno de login, o site não aparece nem por um quadro (conferido com MutationObserver ou captura no primeiro quadro).
4. A sessão de quem já está logado continua valendo depois da troca para o `auth-js` (mesma chave no `localStorage`; o login com senha e com o Google e a demo funcionam no E2E).
5. Lighthouse no celular: desempenho ≥ 90 (mediana de 3), acessibilidade ≥ 95 e SEO 100. JS do app logado ≤ base.
6. Lint, typecheck, testes (web, shared e API) e E2E verdes; o teste das rotas contra o `vercel.json` passando.
7. O `sitemap.xml` sem a `/entrar`.
