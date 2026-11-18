# HANDOFF — FinControl

_Atualizado em 2026-11-18 (assistente com IA)._

## Assistente com IA (2026-11-18, branch feat/assistente)

- **Spec:** `docs/superpowers/specs/2026-11-18-fincontrol-assistente-ia-design.md` (A1–A12).
- **Migration:** `20261118120000_assistente` (coluna `profiles.ai_consent_at` e tabela `ai_usage`). **Antes do deploy da API, aplicar no Supabase.**
- **Variáveis na Vercel (`fincontrol-api`):**
  - `ANTHROPIC_API_KEY` (o console gera chaves `sk-ant-usr-`; as antigas são `sk-ant-api03-`): sem ela, o assistente fica desligado. **Quem cadastra é o usuário**, pelo comando `! cd apps/api && npx vercel env add ANTHROPIC_API_KEY production`, porque o agente não pode digitar chaves;
  - `AI_ALLOWED_EMAILS`: os e-mails que podem usar (`*` libera todas as contas reais; vazia, ninguém usa);
  - `AI_MODEL` (opcional): o padrão é `claude-haiku-4-5-20251001`.
- **Entregue:**
  - `/assistente` no menu do computador, no Perfil e no atalho do painel;
  - consentimento na primeira vez e seção nova na política de privacidade;
  - 5 ferramentas só de leitura (resumo do período, busca de lançamentos, orçamento, metas, saldos e dívidas);
  - conversa só na aba (`sessionStorage`), com as últimas 7 mensagens enviadas a cada pergunta;
  - limites de 100 perguntas por pessoa e 400 no total por dia, guardados em `ai_usage` com os tokens gastos, e 30 por hora contra rajadas;
  - a demo não usa o assistente.
- **Testes:** 133 em shared, 283 na API e 182 na web, além de 13 E2E (o de 360 px cobre `/assistente`).
- **No ar em 2026-11-18** (PRs #21, #22 e #23). A migration foi aplicada em produção. `AI_ALLOWED_EMAILS` libera o usuário e a Juliana.
- **Teste em produção:** feito na conta do usuário (vazia), com perguntas reais, contexto entre perguntas, "Nova conversa", retirar e aceitar o consentimento, e a tela a 360 px (num iframe).
- **Markdown:** o Haiku usa markdown mesmo com o pedido para não usar. O servidor limpa a resposta (`plainText` em `assistant.service.ts`).


## Exportação em Excel para análise (2026-11-18, branch feat/excel)

- **Spec:** `docs/superpowers/specs/2026-11-18-fincontrol-excel-analise-design.md` (E1–E10), com o escopo combinado com o usuário. Sem migration.
- **Entregue:** `GET /reports/export.xlsx` (`exceljs`) e o botão "Baixar Excel" nos relatórios. As abas são Resumo, Lançamentos (Tabela do Excel com filtros), Por categoria (variação em fórmula e "antes × agora" contra a média dos 3 meses anteriores), Mensal, Ano contra ano (até 12 meses), Onde o dinheiro vai (descrições agrupadas), Dia da semana (média diária no fim de semana e nos dias úteis), Pequenos gastos (abaixo de R$ 50), Fixos e variáveis, Dívidas e Saldos. O arquivo recalcula ao abrir (`fullCalcOnLoad`).
- **Dependência:** o `uuid` do `exceljs` foi forçado para a versão 11 (`overrides` na raiz), sem o alerta da 8.
- **E2E:** confere só a assinatura do `.xlsx` (o carregador do Playwright não lê o `exceljs`); o conteúdo é testado na API. `XLSX_OUT=<arquivo>` salva a planilha baixada da demo.
- **Pendente do Web Push:** as chaves VAPID ainda não estão na Vercel (comando no fim da conversa de 2026-11-18).


## Sub-projeto 5, Parte B: Web Push (2026-11-17, branch feat/web-push)

- **Spec:** seção "Parte B" de `docs/superpowers/specs/2026-11-17-fincontrol-sp5-notificacoes-design.md` (decisões W1–W7).
- **Migration:** `web_push` (tabela `push_subscriptions` e `notifications.pushed_at`). **Antes do deploy da API, aplicar no Supabase** pelo comando do usuário.
- **Chaves VAPID:** as de produção estão em `.secrets/vapid.env` (o contato VAPID é o endereço do site, não um e-mail). Vão para as variáveis `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` do projeto `fincontrol-api` na Vercel. Sem elas, o push fica desligado e o Perfil mostra "ainda não estão disponíveis". As chaves de teste ficam em `apps/api/.env.test`.
- **Entregue:**
  - ativação no Perfil (bloco Notificações), com aviso de teste e desligar neste aparelho; explica os casos de bloqueio, de navegador sem suporte e do iPhone sem o app instalado;
  - envio diário às 08:00 de Brasília (cron `send-push`, `0 11 * * *`): uma mensagem por pessoa com os avisos novos não lidos, cada aviso uma vez só, sem contas demo; assinatura expirada é apagada;
  - só endereços de serviços de push conhecidos (Google, Mozilla, Apple, Microsoft), contra SSRF;
  - `public/push-sw.js`, carregado pelo service worker do PWA, mostra o aviso e abre o app só no próprio site.
- **Desligar:** `POST /push/unsubscribe` com o endereço no corpo, porque o log grava as URLs.
- **Testes:** 129 em shared, 260 na API e 172 na web, além de 13 E2E. O E2E pegou o `import default` do `web-push` 4, que é ESM só com exports nomeados e que o Vitest aceitava.
- **Revisão final (revisor novo):** a lista contra SSRF resistiu a todas as tentativas de contorno. Corrigidos: sair da conta cancela a assinatura do navegador (os avisos de uma pessoa não chegam para a próxima); abrir o Perfil confirma a assinatura no servidor antes de mostrar "ligado"; no máximo 10 aparelhos por pessoa e assinatura que só falha há 30 dias é apagada; falha de envio vai para o log (status e host); chaves VAPID com formato validado; avisos reservados de forma atômica (dois envios juntos não repetem, e sem nenhum aparelho recebendo eles voltam para o próximo); clique na notificação abre janela nova se a atual não for do service worker; iPad reconhecido.
- **Teste manual em produção:** ativar no navegador e receber o aviso de teste.


## Sub-projeto 5, Parte A: central de notificações (2026-11-17, branch feat/notificacoes)

- **Spec:** `docs/superpowers/specs/2026-11-17-fincontrol-sp5-notificacoes-design.md`, com as decisões N1–N11 tomadas pelo agente. **Plano:** `docs/superpowers/plans/2026-11-17-fincontrol-sp5-notificacoes.md`.
- **Migration:** `20261117223553_notificacoes` (tabela `notifications` e a coluna `profiles.notification_prefs`), **aplicada no Supabase em 2026-11-17** pelo comando do usuário, antes do merge.
- **Entregue:**
  - o sino com os não lidos no topo de todas as telas e a página `/notificacoes`, com os avisos do mais urgente ao menos (contas vencidas e a vencer, faturas, orçamento e metas concluídas);
  - os avisos são calculados na hora, e o banco guarda só a memória (chave, quando apareceu e quando foi lido). Um aviso some sozinho quando o assunto se resolve, e a mudança de faixa ou de vencimento muda a chave, então ele volta como não lido;
  - as preferências no Perfil (tipos e antecedência de 1, 3 ou 7 dias), que mudam na hora e voltam ao estado anterior se o salvamento falhar;
  - o cron diário (`cleanup-demo`) também apaga a memória de avisos inativos há mais de 60 dias;
  - na demo, uma conta vencendo em 2 dias e a meta concluída "Notebook novo".
- **Cabeçalho do celular:** com o sino, o selo da demo desce para uma segunda linha. O teste de 360 px agora mede o cabeçalho (transbordo e sobreposição com o sino), e foi conferido que ele falha sem a correção.
- **Testes:** 128 em shared, 247 na API e 160 na web, além de 13 E2E (novo: `e2e/tests/notificacoes.spec.ts`).
- **Revisão final (revisor novo):** nada crítico. Corrigidos: o sino não atualizava ao trocar de tela (agora atualiza com o dado velho e ao voltar para a aba); "Pagar" leva ao mês do vencimento (`/lancamentos?mes=AAAA-MM`); preferências salvas pela mutação com estado otimista e ressincronização; "marcar todas" calcula uma vez só. Aceitos e registrados na spec (seção 7.1): memória de tipo desligado por mais de 60 dias e muitas contas vencidas.
- **Pendência do sub-projeto 4 (aceita, não corrigida):** se a 1ª parcela de uma compra feita nos dias 29 a 31 for excluída, a data da compra reconstruída para a dívida do cartão pode ficar 1 ou 2 dias antes. O mês fica certo, então relatório e painel não mudam.
- **Parte B (próxima):** avisos no celular e no navegador (Web Push). Precisa de chaves VAPID nas variáveis da Vercel e de um envio diário.


## Sub-projeto 4: relatórios e exportação (2026-11-17, branch feat/relatorios)

- **Spec:** `docs/superpowers/specs/2026-11-17-fincontrol-sp4-relatorios-exportacao-design.md`, com as decisões R1–R13 tomadas pelo agente. **Plano:** `docs/superpowers/plans/2026-11-17-fincontrol-sp4-relatorios-exportacao.md`.
- **Sem migration:** tudo sai das tabelas que já existem.
- **Entregue:**
  - `/relatorios` com os períodos "Mês", "Ano" e "12 meses": resumo com comparação, categorias, evolução mensal, evolução das dívidas, maiores despesas, saldos no fim do período e notas;
  - `GET /reports`, `GET /reports/export.csv` (padrão do Excel brasileiro) e `GET /reports/export.pdf` (`pdf-lib`, A4);
  - "Total de dívidas" no painel (`debts` no `/dashboard/summary`), com o link "Ver relatórios";
  - "Relatórios" no menu do computador e no Perfil. A barra do celular continua com 6 itens;
  - as pendências do sub-projeto 3: juntar categorias leva o limite (e o diálogo avisa), e o PUT de orçamento devolve o id gravado.
- **Regras de dívida:** a do cartão conta a compra parcelada inteira desde a 1ª parcela, menos pagamentos e estornos (cartão arquivado entra). A do empréstimo é o saldo devedor Price com as parcelas pagas até a data, o mesmo número da tela do empréstimo.
- **Downloads:** a web nomeia o arquivo sozinha (o CORS esconde o `Content-Disposition`) e manda o token só no cabeçalho.
- **Testes:** 120 em shared, 236 na API e 149 na web, além de 12 E2E (novo: `e2e/tests/relatorios.spec.ts`). O teste de 360 px cobre `/relatorios`.
- **Revisão final (revisor novo):** nenhum achado crítico ou alto. Os 5 baixos foram corrigidos: ano antes de 2000 dá 400 (antes, 500); parcela "já paga" adiantada conta no dia do cadastro; acentos decompostos no PDF; título de seção nunca sozinho no pé da página; eixo dos gráficos com "1,5 mil" ou reais abaixo de R$ 1 mil.
- **Cuidado ao editar no Windows:** um `﻿` literal num arquivo-fonte quebra o lint (`no-irregular-whitespace`). Use o escape.


## Sub-projeto 3: planejamento e metas (2026-11-16, branch feat/planejamento)

- **Spec:** `docs/superpowers/specs/2026-11-16-fincontrol-sp3-planejamento-metas-design.md`. As decisões P1–P10 foram tomadas pelo agente, a pedido do usuário ("não me pergunte mais"). **Plano:** `docs/superpowers/plans/2026-11-16-fincontrol-sp3-planejamento-metas.md`.
- **Entregue:**
  - limite mensal por categoria, com o comprometido (pago + a pagar) e as faixas "Dentro", "Perto do limite" e "Estourou";
  - sobra planejada e previsão de 3 meses;
  - metas com depósitos e retiradas, situação e aporte mensal, além do atalho de reserva;
  - o bloco "Orçamento do mês" no painel;
  - na demo, 4 limites (um perto, um estourado) e 2 metas.
- **Navegação:** "Planejamento" entrou no lugar de "Categorias" na barra do celular. Categorias continua no menu do computador e no Perfil.
- **Testes:** o teste de 360 px agora mede conteúdo cortado (o `overflow-x: clip` escondia). Ele achou e corrigiu um corte antigo na legenda do gráfico de categorias.
- **Testes:** 92 em shared, 218 na API e 134 na web, além de 11 E2E.
- **Antes do deploy da API:** aplicar a migration `20261116133954_planejamento` no Supabase (`npx prisma migrate deploy` pelo pooler na porta 5432).

## Sub-projeto 2, Parte A: cartões de crédito (2026-11-13, branch feat/cartoes)

- **Spec:** `docs/superpowers/specs/2026-11-12-fincontrol-sp2-credito-design.md`. **Plano executado:** `docs/superpowers/plans/2026-11-12-fincontrol-sp2-parte-a-cartoes.md` (13 tarefas, um commit por tarefa).
- **Entregue:**
  - cartão como conta `credit_card`, com limite, dia de fechamento e de vencimento, e a conta pagadora;
  - compras à vista e parceladas (até 48x), com o mês da fatura gravado na transação;
  - faturas (aberta, fechada, paga, vencida) e pagamento como transferência;
  - "A pagar" no painel com as faturas, inclusive de cartão arquivado;
  - o tile "Comprometimento de renda" (C13: ≤ 30% "Na meta", até 40% "Atenção", acima disso "Alto"), com o status seguindo o número arredondado exibido;
  - a demo com "Cartão principal", faturas pagas, uma fechada, a aberta e um notebook em 10x;
  - a página `/cartoes/:id` e o link "Ver faturas" em Contas.
- **Testes:** 60 em shared, 172 na API e 95 na web, além de 9 E2E (novo: `e2e/tests/cartao.spec.ts`). O teste de 360 px passou a cobrir a página de faturas. Lint e typecheck limpos.
- **No ar desde 2026-11-15:** PR #11 mergeado (`ebc6d58`). A migration `20261112151556_cartoes` foi aplicada no Supabase antes do merge. A produção foi conferida com Playwright pela demo, a 1440 px e a 360 px: painel, Contas e faturas sem erros e sem rolagem horizontal.
- **Revisão do CodeRabbit:** 5 correções, cada uma com teste. A regra da média do comprometimento (meses sem receita ficam fora) foi mantida e registrada na spec C13.

## Sub-projeto 2, Parte B: empréstimos (2026-11-15, branch feat/emprestimos)

- **Plano executado:** `docs/superpowers/plans/2026-11-15-fincontrol-sp2-parte-b-emprestimos.md` (11 tarefas). Os desvios D1–D6 da spec foram aceitos pelo usuário em 2026-11-15.
- **Entregue:**
  - empréstimos com taxa real (Price), custo total, juros, saldo devedor e quitação estimada;
  - parcelas restantes como lançamentos pendentes (`loanId`), na categoria nova "Empréstimos e financiamentos";
  - comparação com o banco e com a mediana do mercado (Banco Central), com fonte e período;
  - as parcelas do mês no comprometimento de renda;
  - na demo, um financiamento de veículo com 12 de 48 parcelas pagas;
  - as páginas `/emprestimos` e `/emprestimos/:id` e o item "Empréstimos" no menu. A barra do celular, agora com 6 itens, usa fonte de 10 px.
- **Testes:** 77 em shared, 198 na API e 115 na web, além de 10 E2E (novo: `e2e/tests/emprestimo.spec.ts`).
- **No ar desde 2026-11-15:** PR #12 mergeado (`4e52faa`). A migration `20261115195644_emprestimos` foi aplicada no Supabase antes do merge, e a primeira sincronização com o Banco Central gravou as 6 modalidades. A produção foi conferida pela demo, a 1440 px e a 360 px: painel (comprometimento de 16%), lista, detalhe e comparação ("7º de 39"), sem erros e sem rolagem horizontal.
- **Sincronização das taxas:** é automática, toda segunda às 07:00 UTC. Para rodar na mão: `GET /api/v1/internal/cron/sync-bank-rates` com `Authorization: Bearer <CRON_SECRET>`. Leva cerca de 1 minuto.
- **Regras vindas das revisões:**
  - parcela de empréstimo não pode ser excluída nem ter o valor mudado em Lançamentos (422);
  - a conta que paga parcelas pendentes não pode ser arquivada (422) nem excluída (409);
  - "banco do brasil" na busca acha "BCO DO BRASIL S.A.";
  - quando as parcelas somam menos que o valor recebido, a tela mostra "sem juros".
- **Leitura da API do Banco Central (2026-11-15):** só o imobiliário é mensal. Crédito pessoal, consignado e veículos vêm por semana, em `TaxasJurosDiariaPorInicioPeriodo`. As respostas gravadas para os testes ficam em `apps/api/test/fixtures/`.

## Onde estamos (sub-projeto 1)

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
  - Em produção, a conexão valida a cadeia e o host contra a CA oficial do Supabase (`DATABASE_CA_CERT` na Vercel; cópia em `.secrets/supabase-prod-ca-2021.crt`). A CA vale até 2031-04-26. Com a CA, `pgConfig` tira os parâmetros SSL da URL, porque no `pg` eles sobrescreveriam a validação.
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
  - **Google:** o app está publicado ("Em produção") desde 2026-11-11, com a política em `/privacidade`. Qualquer conta Google consegue entrar.
  - Na Vercel, o Git Bash reescreve caminhos `/api/...` no `vercel curl`. Use `MSYS_NO_PATHCONV=1`.

## Próximo passo

- **Parte 2 (Web): concluída** (branch feat/sp1-web, mergeada). Inclui 42 testes, build com PWA e verificação visual sem rolagem horizontal em 360 px. A direção visual está em DESIGN.md ("Aurora no cofre", dourado, com o CoraHub como referência), e a arte de entrada foi gerada no Higgsfield.
- **Parte 3 (combinar com o usuário):**
  - Deploy na Vercel (web + API), com Supabase (Auth: e-mail, Google, anônimo) e Google OAuth.
  - E2E com Playwright: feito (`e2e/`, 7 cenários no CI, com o provedor de identidade simulado em `e2e/fake-auth.ts`).
  - README de vitrine: feito (as imagens vêm de `SCREENSHOTS=1 npm run test:e2e -- screenshots`).
- **Revisão final da Parte 2:** feita como autorrevisão. Corrigido o logout com token expirado, que deixava a sessão presa (teste RED→GREEN). As pendências menores estão na seção abaixo.

## Pendências registradas na revisão final (menores)

Resolvidas em 2026-11-11, cada uma com teste RED→GREEN:

- **Seed da demo atômico.** Roda numa transação do Postgres (`inTransaction` no container). Quem recarrega no meio não vê dados pela metade, e uma falha não trava mais a demo.
- **Busca:** `%`, `_` e `\` são tratados como texto (`escapeLike` no repositório de lançamentos).
- **"Esta e as próximas":** mover uma ocorrência paga para a data de outra paga da mesma série dá 422 com mensagem clara, antes de qualquer escrita. Antes dava 500.
- **Build sem variáveis:** mostra a tela "O FinControl não está configurado", com os nomes das variáveis, em vez da tela em branco (`checkEnv` + `ConfigErrorScreen`).
- **Corrigido antes:** criar um item enquanto a lista ainda carregava pela primeira vez não o mostrava (corrida do React Query). Agora `useFinanceMutation` cancela antes de invalidar.

- **Nova tentativa da demo:** depois de uma falha no seed, a nova tentativa reaproveita o usuário anônimo existente.
- **Cron:** registrado na Vercel (`0 6 * * *`). Testado em produção: 401 sem segredo e `{"deleted":0}` com segredo.
- **Google:** login testado de ponta a ponta pelo usuário em 2026-11-12.

## Termos e região (2026-11-12)

- Os termos de uso estão em `/termos`, com idade mínima de 18 anos. A tela de entrada avisa e liga para os termos.
- A API está fixada em São Paulo (`apps/api/vercel.json` → `regions: ["gru1"]`). Antes rodava em `iad1` (EUA), e cada consulta ao banco cruzava o continente.

## Skills de finanças (2026-11-12)

- Há 25 skills em `.claude/skills/`, escolhidas entre 696 e auditadas. O mapa de onde cada uma entra no produto está em `docs/skills-no-fincontrol.md`.
- CodeRabbit (app do GitHub) está instalado só no repositório FinControl e revisa as PRs.

## Como rodar

Ver o `README.md` (`npm run db:up`, `npm run db:migrate`, `npm run dev:api`, `npm test`).
