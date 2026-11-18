# FinControl — Sub-projeto 5: Notificações

- **Data:** 2026-11-17
- **Status:** decisões tomadas pelo agente. Em 2026-11-15, o usuário pediu "não me pergunte mais, me entregue o projeto pronto". Cada decisão abaixo traz o motivo para revisão posterior.
- **Origem:** seção 09 (Notificações) de `Ideia Projeto.txt`. No roadmap original (spec do sub-projeto 1, seção 1.1), é o item 6.
- **Base de domínio:** skill `next-best-action` (regras com gatilho, prioridade e só os avisos mais valiosos no topo), em `docs/skills-no-fincontrol.md`, seção 6.
- **Banco:** uma tabela nova e uma coluna nova, então **há migration**. Ela só vai para produção com o comando do usuário.

## 1. Objetivo

A pessoa abre o app e vê, num só lugar, **o que precisa da atenção dela agora**: contas que vencem logo ou já venceram, faturas a pagar, categorias perto do limite ou estouradas e metas alcançadas.

O que a seção 09 pede, e como entra:

| Pedido | Como entra |
|---|---|
| Contas próximas do vencimento | Despesas pendentes que vencem nos próximos dias (3 por padrão). |
| Faturas em aberto | Faturas fechadas a pagar e faturas vencidas. |
| Orçamento próximo do limite | Categorias "Perto do limite" e "Estourou" no mês (regra P3 do sub-projeto 3). |
| Metas alcançadas | Metas que chegaram ao valor alvo. |
| Lembretes de pagamentos | As contas próximas do vencimento e as vencidas, com link para pagar. |

## 2. Decisões

| # | Decisão | Alternativas descartadas | Motivo |
|---|---|---|---|
| N1 | **Parte A (este documento): central de notificações dentro do app**, com um sino e um contador no topo de todas as telas e a página `/notificacoes`. **Parte B (depois): aviso no celular e no navegador (Web Push)**, que exige chaves VAPID configuradas na Vercel e um envio diário. | E-mail; tudo de uma vez | O e-mail exige um provedor externo e conta nova. A central já cumpre a seção 09 e é a base da Parte B. O sub-projeto 2 também foi dividido assim. |
| N2 | **Os avisos são calculados na hora a partir dos dados**, e o banco guarda só a "memória" de cada aviso (chave, quando apareceu e quando foi lido). Quando a condição acaba (a conta foi paga, a categoria voltou ao limite), o aviso some sozinho. | Gravar cada aviso num job diário | Não fica aviso velho de conta já paga. Também dispensa um cron só para a Parte A. |
| N3 | **Chave estável por aviso:** `due:<lançamento>:<vencimento>`, `overdue:<lançamento>:<vencimento>`, `invoice:<cartão>:<mês>:<situação>`, `budget:<categoria>:<mês>:<faixa>` e `goal:<meta>:reached`. Mudou o vencimento, a situação ou a faixa, a chave muda e o aviso volta como não lido. | Um aviso por dia | Sem repetir o mesmo aviso todo dia. Um agravamento ("perto" → "estourou") avisa de novo. |
| N4 | **Regras:** (a) despesa pendente vencendo de hoje até hoje + N dias, com N = 3 por padrão; (b) despesa pendente vencida; (c) fatura fechada com restante > 0 e fatura vencida (a mesma situação de "A pagar", R16 do sub-projeto 2); (d) categoria do mês atual em "Perto do limite" ou "Estourou"; (e) meta concluída, mostrada por 30 dias a partir da primeira vez. Parcelas de empréstimo contam como despesa pendente. | Avisos de reserva baixa ou de sobra do mês | Atende o que a seção 09 pede. Os avisos de "próxima melhor ação" ficam para o assistente com IA (sub-projeto 6). |
| N5 | **Prioridade** (skill `next-best-action`): vencida = 1, fatura vencida = 1, estourou = 2, vence em breve = 2, fatura fechada = 2, perto do limite = 3, meta concluída = 4. A lista ordena por prioridade e depois pela data. O contador conta só os não lidos. | Ordem só por data | O que custa juros e multa aparece primeiro. |
| N6 | **Lido:** abrir a página `/notificacoes` não marca nada sozinho. Cada aviso tem a ação ("Pagar", "Ver fatura", "Ver orçamento", "Ver metas"), e clicar nela marca como lido. Também há "Marcar todas como lidas". | Marcar tudo ao abrir | O contador só cai quando a pessoa realmente viu cada aviso. |
| N7 | **Preferências no Perfil:** ligar ou desligar cada tipo (contas, faturas, orçamento, metas) e escolher a antecedência das contas (1, 3 ou 7 dias). Ficam numa coluna JSON em `profiles`, e um tipo desligado não aparece nem no contador. | Tabela própria | São 5 valores por pessoa, lidos sempre juntos. |
| N8 | **Limpeza:** a memória de avisos que não estão mais ativos é apagada depois de 60 dias, no cron diário que já existe (`cleanup-demo`, que passa a se chamar internamente `cleanup`). | Guardar para sempre | A tabela não cresce sem fim. A rota antiga continua respondendo. |
| N9 | **Sino:** no topo de todas as telas, no computador e no celular, com o número de não lidos (até "9+") e um rótulo acessível ("Notificações, 3 não lidas"). A barra do celular não muda. | Item novo na barra do celular | A barra já tem 6 itens (P9 e R12). |
| N10 | **Atualização do contador:** a lista é buscada ao abrir o app, ao trocar de tela (com cache de 60 s) e depois de qualquer lançamento, pagamento ou mudança de orçamento (chave `notifications` nas invalidações). | Busca a cada poucos segundos | Os avisos só mudam quando a pessoa mexe nos dados ou o dia vira. |
| N11 | **Demo:** a demo já tem uma conta vencida, categorias perto do limite e estouradas e uma fatura. O seed ganha uma despesa pendente vencendo em 2 dias e uma terceira meta já concluída, para todos os tipos aparecerem. | Sem mudar o seed | O visitante vê a central completa. |

## 3. Modelo de dados (Prisma)

- **`Notification` (`notifications`):**
  - `id`, `userId` (FK `profiles`, cascade) e `key` (texto até 200);
  - `firstSeenAt` (timestamptz, padrão agora), `readAt` (timestamptz, opcional) e `lastActiveAt` (timestamptz, atualizado a cada cálculo em que o aviso está ativo);
  - unique (`userId`, `key`) e índice (`lastActiveAt`).
- **`profiles.notification_prefs`** (JSONB, padrão `{}`). O que falta vem dos padrões: tudo ligado, 3 dias.
- **RLS** ligado na tabela nova, no padrão das migrations anteriores.

## 4. Regras (funções puras em `packages/shared/src/notifications.ts`, com testes)

- **`notificationPrefs(raw)`:** completa os padrões e ignora valores inválidos.
- **`dueSoon(dueDate, today, days)`:** se a data está de hoje até hoje + `days`.
- **`daysLabel(dueDate, today)`:** "vence hoje", "vence amanhã", "vence em 3 dias", "venceu ontem" ou "venceu há 5 dias".
- **`sortNotifications(list)`:** N5.
- **`goalReachedVisible(firstSeenAt, now)`:** os 30 dias de N4 (e).

## 5. API (`/api/v1`)

- **`GET /notifications`** devolve `{ items: [{ key, kind, priority, title, body, href, action, date, read }], unreadCount }`. `kind` é um de `bill_due`, `bill_overdue`, `invoice_closed`, `invoice_overdue`, `budget_near`, `budget_over` e `goal_reached`.
- **`POST /notifications/read`** com `{ keys: string[] }` (de 1 a 100) marca como lidos. Chave que não está ativa é ignorada.
- **`POST /notifications/read-all`** marca todos os ativos como lidos.
- **`GET /me`** e **`PATCH /me`** ganham `notificationPrefs: { bills, invoices, budget, goals, billDays }`.
- O cron diário apaga a memória inativa há mais de 60 dias (N8).
- **Isolamento:** tudo filtra por `userId`.

## 6. Telas

- **Sino** no cabeçalho (N9). Leva para `/notificacoes`.
- **`/notificacoes`:**
  - lista ordenada (N5), cada aviso com ícone e cor do tipo (sempre com texto), título, detalhe, data relativa, marca de não lido e o botão da ação;
  - "Marcar todas como lidas";
  - estado vazio: "Tudo em dia".
- **Perfil:** o bloco "Notificações", com as preferências de N7.

## 7. Testes

- **Domínio:** padrões e valores inválidos das preferências, janela de vencimento (hoje, limite, passado), rótulos, ordenação e os 30 dias da meta.
- **API (Postgres real):**
  - cada regra gera o aviso certo, com a chave certa;
  - pagar a conta faz o aviso sumir;
  - a faixa do orçamento muda a chave;
  - lido e não lido, e "marcar todas";
  - preferências desligando tipos e mudando a antecedência;
  - limpeza de 60 dias;
  - isolamento.
- **Web:** o sino com o contador e o rótulo, a página (ordem, ação marcando como lido, "marcar todas", estado vazio) e as preferências no Perfil.
- **E2E:** a demo mostra o contador, abrir um aviso e clicar na ação diminui o contador; nenhuma rolagem horizontal a 360 px.

## 7.1 Limites aceitos (revisão final, 2026-11-17)

- **Tipo desligado por mais de 60 dias:** a memória dele é apagada pela limpeza (N8). Ao religar, avisos antigos ainda ativos (uma conta vencida há meses, uma meta concluída) voltam como não lidos. Renovar a memória de tipos desligados custaria calcular regras que a pessoa pediu para não ver. O efeito é um aviso repetido, sem perda de dado.
- **Muitas contas vencidas:** cada parcela pendente vencida vira um aviso (uma recorrência criada com início antigo pode gerar dezenas). O painel já conta assim desde o sub-projeto 1 (`countOverdue`). Agrupar por recorrência fica para depois, se aparecer na prática.
- **"Pagar"** leva para `/lancamentos?mes=AAAA-MM`, o mês do vencimento: uma conta vencida no mês passado não está na lista do mês atual.

## 8. Fora do escopo

Parte B (Web Push), e-mail, avisos de "próxima melhor ação" (ficam para o assistente com IA), avisos de outras pessoas e som.

## 9. Critérios de aceite

1. Uma despesa pendente que vence em 2 dias aparece como "vence em 2 dias", com o valor e o botão "Pagar". Depois de paga, o aviso some.
2. Uma despesa vencida aparece no topo da lista.
3. Uma categoria que passa de "Perto do limite" para "Estourou" volta a contar como não lida.
4. Clicar na ação de um aviso diminui o contador em 1. "Marcar todas como lidas" zera o contador.
5. Desligar "Orçamento" no Perfil tira esses avisos da lista e do contador.
6. Nenhuma rota nova expõe dados de outro usuário.
7. CI verde (lint, typecheck, unitários, integração e E2E), com tudo no ar e a migration aplicada.

---

# Parte B: avisos no celular e no navegador (Web Push)

- **Data:** 2026-11-17. Decisões tomadas pelo agente, como na Parte A.
- **Banco:** uma tabela nova e uma coluna nova, então **há migration**. Ela só vai para produção com o comando do usuário.

## B1. Decisões

| # | Decisão | Alternativas descartadas | Motivo |
|---|---|---|---|
| W1 | **Web Push padrão (VAPID) com a biblioteca `web-push` na API.** As chaves ficam nas variáveis `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`. Sem elas, o push fica desligado e o app mostra "indisponível". | Firebase Cloud Messaging; OneSignal | Funciona em Chrome, Edge, Firefox, Android e no iPhone com o app instalado na tela inicial (iOS 16.4+), sem conta em serviço externo. |
| W2 | **O que vai por push são os avisos da central (Parte A) que ainda não foram enviados nem lidos.** Cada aviso vai uma vez só (coluna `pushed_at` na memória). Uma mensagem por pessoa, com o aviso mais urgente no título e "e mais N" no texto; tocar abre `/notificacoes`. | Um push por aviso | Uma notificação por dia não vira spam. As regras e preferências (N4–N7) continuam valendo. |
| W3 | **Envio diário às 08:00 de Brasília** (cron da Vercel, `0 11 * * *`). Contas demo ficam de fora. Assinatura que o serviço de push responde como expirada (404 ou 410) é apagada. | Envio a cada hora | O plano gratuito da Vercel só permite cron diário. As contas vencem por dia. |
| W4 | **Ativação no Perfil**, no bloco "Notificações": "Receber no celular e no navegador" pede a permissão (exige o clique da pessoa), grava a assinatura e permite desligar. Há o botão "Enviar um aviso de teste". O bloco explica os casos "bloqueado no navegador", "este navegador não suporta" e, no iPhone, "instale o app na tela inicial". | Pedir permissão ao abrir o app | Pedir sem contexto leva ao bloqueio. A pessoa decide. |
| W5 | **Endereço da assinatura só de serviços de push conhecidos** (Google, Mozilla, Apple, Microsoft). Outro endereço dá 422. | Aceitar qualquer URL | A API faz um POST para esse endereço. Sem a lista, ela poderia ser usada para chamar endereços internos (SSRF). |
| W6 | **Uma assinatura por navegador** (o endereço é único). Se outra pessoa entrar no mesmo navegador e ativar, a assinatura passa para ela. Excluir a conta apaga as assinaturas (cascade). | — | O aparelho recebe os avisos de quem está usando. |
| W7 | **Service worker:** o do PWA ganha `push-sw.js` (via `importScripts`), que mostra a notificação e abre o app no clique. | Trocar o modo do PWA para `injectManifest` | Muda menos o que já funciona. |

## B2. Modelo de dados

- **`PushSubscription` (`push_subscriptions`):** `id`, `userId` (FK `profiles`, cascade), `endpoint` (único, até 1000), `p256dh`, `auth`, `createdAt`, `lastSuccessAt` (opcional). RLS ligado.
- **`notifications.pushed_at`** (timestamptz, opcional).

## B3. API

- **`GET /push/config`:** `{ enabled, publicKey }`.
- **`POST /push/subscriptions`:** `{ endpoint, keys: { p256dh, auth } }`. Cria ou passa para o usuário atual. Endereço fora da lista dá 422; push desligado dá 503.
- **`POST /push/unsubscribe`:** `{ endpoint }`, só do próprio usuário. É POST com corpo para o endereço da assinatura não ir na URL, que o log de requisições grava.
- **`POST /push/test`:** manda "Os avisos do FinControl estão ligados" para as assinaturas do usuário e devolve quantas receberam.
- **Cron `GET /internal/cron/send-push`:** W2 e W3. Devolve `{ users, sent, removed }`.

## B4. Testes

- **API:** assinatura (criar, trocar de dono, apagar, lista de serviços, isolamento), envio de teste, cron (só o que não foi enviado nem lido, uma mensagem por pessoa, demo de fora, assinatura expirada apagada, preferências respeitadas). O envio real é trocado por um falso nos testes.
- **Web:** o bloco do Perfil em cada estado (indisponível, sem suporte, bloqueado, desligado, ligado), ativar, desativar e o teste.
- **Manual em produção:** ativar no navegador e receber o aviso de teste.

## B5. Critérios de aceite

1. Ativar no Perfil pede a permissão e, aceita, o "aviso de teste" chega no aparelho.
2. O envio diário manda um único push com os avisos novos, e no dia seguinte não repete os mesmos.
3. Uma assinatura expirada é apagada no envio.
4. Endereço de assinatura fora dos serviços conhecidos é recusado.
5. CI verde e tudo no ar, com a migration aplicada e as chaves na Vercel.
