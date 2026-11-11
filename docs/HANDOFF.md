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
- **Auth:** login anônimo ligado e confirmação de e-mail ligada, via `supabase config push`. O `site_url` é http://localhost:5173 e deve ser trocado pela URL da Vercel no deploy. O Google OAuth ainda falta (o usuário precisa gerar as credenciais).
- **Verificado de ponta a ponta:** login anônimo → `POST /demo/seed` → dashboard com dados (API local contra o Supabase real).

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
- O CORS aceita uma única origem. Na Parte 3, liberar os previews da Vercel.

## Como rodar

Ver o `README.md` (`npm run db:up`, `npm run db:migrate`, `npm run dev:api`, `npm test`).
