# HANDOFF — FinControl

_Atualizado em 2026-11-11._

## Onde estamos

- **Sub-projeto 1, Parte 1 (API): concluída** e na `main`.
  - 131 testes verdes: 39 em shared e 92 na API, contra Postgres real.
  - Lint e typecheck limpos.
  - Smoke test do servidor real OK.
- Spec: `docs/superpowers/specs/2026-11-11-fincontrol-fundacao-fluxo-caixa-design.md`
- Plano executado: `docs/superpowers/plans/2026-11-11-fincontrol-sp1-parte1-api.md`

## Supabase (criado em 2026-11-11)

- **Projeto:** `fincontrol` (ref `ojywswdjhjmwnfhalntl`, região sa-east-1, plano gratuito), criado pela CLI (`npx supabase`, já autenticada na conta do usuário).
- **Segredos:** em `.secrets/`, que é gitignored: senha do banco, chaves da API, `api.production.env` e `web.production.env`. O `apps/web/.env.local` já aponta para o Supabase.
- **Banco:** migrations aplicadas pelo pooler `aws-0-sa-east-1.pooler.supabase.com` (5432 para migrations, 6543 em runtime com `sslmode=require&uselibpqcompat=true`).
  - Melhoria pendente: usar o certificado CA do Supabase em vez do modo libpq.
- **Auth:** login anônimo ligado e confirmação de e-mail ligada, via `supabase config push`. O `site_url` é http://localhost:5173 e deve ser trocado pela URL da Vercel no deploy. O Google OAuth está ligado desde 2026-11-11 e foi verificado: o redirect do Supabase leva ao client certo.
- **Config versionada:** `supabase/config.toml` (projeto já vinculado com `supabase link`) espelha o remoto. `echo n | npx supabase config push` mostra o diff sem aplicar nada e hoje dá "up to date" em todos os serviços. Os redirects permitidos são `localhost:5173` e `localhost:4173`. O Google está `enabled = true`. O client id e o secret ficam em `.secrets/google-oauth.env` e precisam ser exportados antes de qualquer `config push`, senão o push manda valores vazios.
- **Google Cloud:** projeto `fincontrol-514416`, OAuth client "FinControl Web (Supabase)" com o callback `https://ojywswdjhjmwnfhalntl.supabase.co/auth/v1/callback`.
  - O app está em modo **Testando**: só os usuários de teste conseguem logar (hoje, o e-mail do dono). Para abrir ao público, publique o app na tela Público-alvo.
- **Verificado de ponta a ponta:** login anônimo → `POST /demo/seed` → dashboard com dados (API local contra o Supabase real).

## Vercel (2026-11-11, branch feat/sp1-deploy)

- **Projetos:** dois, conectados ao repo do GitHub (`vercel link --repo` gera `.vercel/repo.json`, gitignored).
  - `fincontrol-web`: root `apps/web`, domínio https://fincontrol-gb.vercel.app.
  - `fincontrol-api`: root `apps/api`, domínio https://fincontrol-api-gb.vercel.app.
- **API:** a entrada é `src/index.ts` com `export default app`. O `src/server.ts` só serve para o dev local.
  - Precisa de `VERCEL_EXPERIMENTAL_BACKENDS=1`: os imports sem extensão e o `@fincontrol/shared` em TS não rodam no builder padrão.
  - O cron diário fica em `apps/api/vercel.json`.
- **Web:** o rewrite de SPA fica em `apps/web/vercel.json`.
- **Variáveis:** de produção e de preview, todas carregadas a partir de `.secrets/`. O `.vercelignore` da raiz impede o upload de `.secrets` e `.env*`.
- **Logs:** o logger HTTP registra só id, método, URL e status. Antes, gravava todos os headers, inclusive tokens da Vercel e IP/geolocalização.
- **Estado:**
  - Web em produção. Foi o primeiro deploy do projeto, e a Vercel promoveu sozinha.
  - API validada em preview: health, 401 sem token, `/me` e `/accounts` com sessão anônima real.
  - API em produção desde 2026-11-11, com deploy feito pelo usuário. Verificado no navegador: login anônimo, demo e dashboard com dados reais.
- **Supabase:** `site_url` = https://fincontrol-gb.vercel.app, que também está na lista de redirects.
- **Pendências:**
  - **CORS de previews: resolvido.** `WEB_PREVIEW_ORIGIN_PATTERN` é uma regex que o app ancora sozinho, configurada na Vercel com as URLs do time.
  - **Supabase, redirects dos previews: resolvido** (pelo dashboard, autorizado pelo usuário). O padrão é `https://fincontrol-*-gabriel-botelhos-projects.vercel.app/**`, que cobre só os previews do FinControl. O `config.toml` está espelhado e o diff deu zero.
  - **PR #3 mergeado na `main`.** O deploy de produção dos dois projetos foi verificado: health ok e CORS de preview ativo.
  - **Google:** a página `/privacidade` (pública, com link na tela de entrada) foi criada na branch feat/privacidade. Depois do merge: colar https://fincontrol-gb.vercel.app/privacidade no Branding do Google Cloud e clicar em "Publicar app" em Público-alvo.
  - Na Vercel, o Git Bash reescreve caminhos `/api/...` no `vercel curl`. Use `MSYS_NO_PATHCONV=1`.

## Próximo passo

- **Parte 2 (Web): concluída** (branch feat/sp1-web, mergeada). Inclui 42 testes, build com PWA e verificação visual sem rolagem horizontal em 360 px. A direção visual está em DESIGN.md ("Aurora no cofre", dourado, com o CoraHub como referência), e a arte de entrada foi gerada no Higgsfield.
- **Parte 3 (combinar com o usuário):**
  - Deploy na Vercel (web + API), com Supabase (Auth: e-mail, Google, anônimo) e Google OAuth.
  - E2E com Playwright: o roteiro com sessão simulada fica como base em scratchpad/visual.mjs.
  - README de vitrine com os screenshots.
- **Revisão final da Parte 2:** feita como autorrevisão. Corrigido o logout com token expirado, que deixava a sessão presa (teste RED→GREEN). Pendências menores: se a geração da demo falhar depois do login anônimo, um novo clique cria outro usuário anônimo; e o `readEnv` falha com tela em branco quando faltam variáveis no build.

## Pendências registradas na revisão final (menores)

- Seed da demo não é atômico. O botão no front deve ser desabilitado durante a chamada.
- A busca `q` trata `%` e `_` como curingas.
- `updateFuture` com data coincidente de outra ocorrência paga pode dar 500 (caso raro).

## Como rodar

Ver o `README.md` (`npm run db:up`, `npm run db:migrate`, `npm run dev:api`, `npm test`).
