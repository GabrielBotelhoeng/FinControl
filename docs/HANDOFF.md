# HANDOFF — FinControl

_Atualizado em 2026-11-11._

## Onde estamos

- **Sub-projeto 1, Parte 1 (API): concluída** e na `main`.
  - 131 testes verdes: 39 em shared e 92 na API, contra Postgres real.
  - Lint e typecheck limpos.
  - Smoke test do servidor real OK.
- Spec: `docs/superpowers/specs/2026-11-11-fincontrol-fundacao-fluxo-caixa-design.md`
- Plano executado: `docs/superpowers/plans/2026-11-11-fincontrol-sp1-parte1-api.md`

## Próximo passo

1. **Escrever o plano da Parte 2 (Web)** com a skill `superpowers:writing-plans`.
   - Começa pela direção visual (paleta, tipografia, tokens). O Higgsfield está liberado para imagens da landing e da demo.
   - Escopo: React + Vite + Tailwind + shadcn/ui, PWA, telas da seção 8 da spec e cliente HTTP com JWT do Supabase.
2. **Parte 3:** Playwright E2E, deploy na Vercel (web + api), Supabase (Auth: e-mail, Google, anônimo) e README de vitrine.
   - Pedir ao usuário: projeto Supabase, conta Vercel e credenciais OAuth do Google.

## Pendências registradas na revisão final (menores)

- Seed da demo não é atômico. O botão no front deve ser desabilitado durante a chamada.
- A busca `q` trata `%` e `_` como curingas.
- `updateFuture` com data coincidente de outra ocorrência paga pode dar 500 (caso raro).
- O CORS aceita uma única origem. Na Parte 3, liberar os previews da Vercel.

## Como rodar

Ver o `README.md` (`npm run db:up`, `npm run db:migrate`, `npm run dev:api`, `npm test`).
