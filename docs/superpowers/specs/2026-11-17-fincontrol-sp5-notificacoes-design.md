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
