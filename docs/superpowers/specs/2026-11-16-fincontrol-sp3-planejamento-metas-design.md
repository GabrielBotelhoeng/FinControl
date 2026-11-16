# FinControl — Sub-projeto 3: Planejamento e metas

- **Data:** 2026-11-16
- **Status:** decisões tomadas pelo agente. Em 2026-11-15, o usuário pediu "não me pergunte mais, me entregue o projeto pronto". Cada decisão abaixo traz o motivo para revisão posterior.
- **Origem:** seções 05 (Planejamento financeiro) e 06 (Metas financeiras) de `Ideia Projeto.txt`.
- **Base de domínio:** skills `savings-goals`, `emergency-fund` e `finance-psychology` (`docs/skills-no-fincontrol.md`, seção 4).

## 1. Objetivo

A pessoa deve saber **quanto pode gastar em cada categoria no mês, quanto já gastou e quanto deve sobrar**, e acompanhar **objetivos de economia** com prazo e valor.

O que a seção 05 pede, e como entra:

| Pedido | Como entra |
|---|---|
| Orçamento mensal | Soma dos limites por categoria. |
| Limites por categoria | Um limite mensal por categoria de despesa. |
| Planejamento de receitas | Receitas do mês, pagas e previstas, ao lado do orçamento, com a "sobra planejada". |
| Previsão de despesas futuras | Receitas e despesas dos próximos 3 meses, a partir dos lançamentos e das recorrências. |
| Alertas de orçamento ultrapassado | Situação por categoria e um aviso no painel. |

O que a seção 06 pede: criar objetivos, valor desejado, prazo, registrar depósitos e acompanhar o percentual alcançado.

## 2. Decisões

| # | Decisão | Alternativas descartadas | Motivo |
|---|---|---|---|
| P1 | **Um limite mensal por categoria de despesa, que vale para todos os meses.** Mudar o limite muda todos os meses, inclusive os passados. | Limite por mês; orçamento total sem categorias | É o uso comum ("R$ 800 de mercado por mês"). Limite por mês multiplicaria o cadastro sem pedido para isso. |
| P2 | **O comprometido do mês = despesas pagas + despesas pendentes da categoria com vencimento no mês.** Compras no cartão contam na data da compra (C1 do sub-projeto 2), e parcelas de empréstimo contam na categoria delas. Transferências não contam. | Contar só as pagas | O alerta precisa avisar antes de estourar. As pendentes do mês já são gasto contratado. |
| P3 | **Faixas pela porcentagem comprometida, arredondada como é exibida:** até 79% "Dentro do limite", de 80% a 100% "Perto do limite", acima de 100% "Estourou". Sempre com ícone e texto. | Faixa única | Mesma regra de arredondamento dos indicadores de saúde (a tela nunca contradiz o rótulo). |
| P4 | **Limite sugerido = média do gasto pago da categoria nos 3 meses completos anteriores**, contando só os meses com gasto, arredondada para cima em R$ 10. Aparece como sugestão no formulário e nunca é gravada sozinha. | Sem sugestão | Ajuda quem não sabe por onde começar, com a mesma janela da reserva. |
| P5 | **Planejamento do mês:** receitas (pagas + previstas), orçamento total (soma dos limites), comprometido total e **sobra planejada = receitas do mês − orçamento total**. Também mostra **previsão dos próximos 3 meses** (receitas e despesas pagas + pendentes por vencimento, depois de materializar as recorrências até o fim do 3º mês). | Projeção estatística | Usa o que existe (lançamentos e recorrências), sem inventar números. |
| P6 | **Meta = nome, valor alvo e prazo (data).** O progresso vem de **depósitos registrados na meta**, que não mexem em saldo de conta: o dinheiro já está em alguma conta, e a meta marca quanto dele é para aquele objetivo. Retirada é um depósito negativo. | Meta ligada a conta; depósito como transferência | A seção 06 pede "registrar depósitos". Ligar a contas obrigaria a ter uma conta por meta. |
| P7 | **Situação da meta:** "Concluída" (guardado ≥ alvo); "Prazo vencido" (passou do prazo sem concluir); "No ritmo" (guardado ≥ alvo × fração do tempo decorrido desde a criação, com 1 ponto percentual de folga); "Atrasada" (abaixo disso). **Aporte mensal necessário** = (alvo − guardado) ÷ meses até o prazo, contando o mês atual (mínimo 1), arredondado para cima no centavo. Sem rendimento nem inflação, e a tela diz isso. | Corrigir pelo IPCA (skill `savings-goals`) | O IPCA exige uma fonte nova. Fica para quando houver contas de investimento detalhadas. |
| P8 | **Atalho "Meta de reserva de emergência"** pré-preenche o alvo com 6 × o gasto médio mensal (o mesmo do indicador de reserva) e o prazo de 12 meses. A pessoa pode editar antes de salvar. | Criar automaticamente | A skill `savings-goals` põe a reserva primeiro na ordem de prioridade. A pessoa decide. |
| P9 | **Telas:** a página `/planejamento` tem duas abas, "Orçamento" e "Metas". No menu do computador entra o item "Planejamento". Na barra do celular, que já tem 6 itens, "Planejamento" **toma o lugar de "Categorias"**, que continua acessível pelo Perfil e pelo orçamento. | 7 itens na barra | 7 itens não cabem a 360 px. Categorias é a tela de uso mais raro. |
| P10 | **Painel:** um bloco "Orçamento do mês" (comprometido ÷ orçamento total e quantas categorias estão perto ou estouradas), com link para o planejamento. Sem orçamento cadastrado, o bloco convida a criar um. | Tile novo nos indicadores | Os indicadores são de saúde financeira. O orçamento é acompanhamento do mês. |

## 3. Modelo de dados (Prisma)

- **`Budget` (`budgets`):**
  - `id`, `userId` (FK `profiles`, cascade) e `categoryId` (FK `categories`, cascade);
  - `limitAmount` (BigInt > 0), `createdAt` e `updatedAt`;
  - unique (`userId`, `categoryId`).
  - Excluir a categoria apaga o limite dela.
- **`Goal` (`goals`):**
  - `id`, `userId` (FK `profiles`, cascade), `name` e `targetAmount` (BigInt > 0);
  - `targetDate` (Date), `createdAt` e `updatedAt`.
- **`GoalContribution` (`goal_contributions`):**
  - `id`, `goalId` (FK `goals`, cascade) e `userId`;
  - `amount` (BigInt ≠ 0; negativo = retirada), `date` (Date), `note` (opcional, até 80 caracteres) e `createdAt`.
- **RLS** ligado nas três tabelas, e **CHECK** nos valores, no padrão das migrations anteriores.

## 4. Regras (funções puras em `packages/shared/src/planning.ts`, com testes)

- **`budgetStatus(committed, limit)`:** a faixa de P3.
- **`suggestedLimit(monthlyPaid: number[])`:** P4. Sem gasto, o resultado é `null`.
- **`goalProgress({ target, saved, createdAt, targetDate, today })`:** devolve
  - `fraction` (0 a 1, limitada);
  - `status` (`reached` | `overdue` | `on_track` | `late`);
  - `monthlyNeeded` (centavos, 0 quando concluída);
  - `monthsLeft`.
- **`monthsUntil(today, targetDate)`:** quantos meses de calendário vão do mês atual até o mês do prazo, contando os dois, com mínimo de 1.

## 5. API (`/api/v1`)

- **`GET /budgets?month=AAAA-MM`:** devolve
  - `{ month, items: [{ categoryId, name, icon, color, limit, paid, pending, committed, status, suggested }], categoriesWithoutBudget: [{ categoryId, name, icon, color, suggested }], totals: { limit, committed }, income: { paid, pending }, plannedLeftover }`;
  - só as categorias de despesa do usuário.
- **`PUT /budgets/:categoryId`:** `{ limit }`. Cria ou atualiza. A categoria precisa ser de despesa e do usuário; outro caso dá 404, e uma categoria de receita dá 422.
- **`DELETE /budgets/:categoryId`.**
- **`GET /planning/forecast?months=3`:** `[{ month, income, expense }]` do mês atual + os 2 seguintes (pagas + pendentes por vencimento).
- **Metas:**
  - `GET /goals` (com progresso) e `POST /goals`;
  - `GET /goals/:id` (com os depósitos) e `PATCH /goals/:id` (nome, alvo, prazo);
  - `DELETE /goals/:id`;
  - `POST /goals/:id/contributions` e `DELETE /goals/:id/contributions/:contributionId`.
- **Validação:**
  - prazo no passado ao criar dá 400 (forma);
  - retirada maior que o guardado dá 422 ("Não dá para retirar mais do que está guardado");
  - depósito com data futura dá 400.
- **`/dashboard/summary`** ganha `budget: { limit, committed, nearCount, overCount } | null` (`null` sem nenhum limite).
- **Isolamento:** toda rota filtra por `userId`. Recurso de outro usuário dá 404.

## 6. Telas

- **`/planejamento`, aba Orçamento:**
  - seletor de mês;
  - resumo com receitas do mês, orçamento total, comprometido e sobra planejada;
  - lista das categorias com limite, cada uma com barra (`progressbar`), "R$ X de R$ Y", situação com ícone e texto, e ações de editar e remover;
  - "Definir limite" para as categorias sem limite, com a sugestão de P4;
  - bloco "Próximos 3 meses" (receitas, despesas e saldo previsto de cada mês).
- **`/planejamento?aba=metas`, aba Metas:**
  - cartões de meta com barra, "R$ X de R$ Y", situação e "Guarde R$ Z por mês até mm/aaaa";
  - "Nova meta" e o atalho "Meta de reserva de emergência" (P8);
  - o detalhe abre num diálogo com os depósitos, "Registrar depósito" e "Registrar retirada", editar e excluir.
- **Painel:** o bloco "Orçamento do mês" (P10).
- **Navegação:** P9. O Perfil ganha o link "Gerenciar categorias".

## 7. Demo

- **Limites:**
  - Alimentação, que fica perto do limite no mês atual;
  - Lazer, que estoura;
  - Compras e Moradia, dentro do limite.
- **Metas:**
  - "Reserva de emergência", com depósitos mensais nos 6 meses de histórico e no ritmo;
  - "Viagem de férias", com prazo em 8 meses e atrasada.

## 8. Testes

- **Domínio:** faixas e arredondamento, sugestão, progresso (todas as situações), meses até o prazo (virada de ano e prazo no mês atual).
- **API (Postgres real):**
  - orçamento com despesas pagas e pendentes, cartão, transferência ignorada e categoria de receita recusada;
  - previsão com recorrência;
  - metas e depósitos, com a retirada acima do guardado;
  - painel;
  - isolamento.
- **Web:** página de orçamento, formulário de limite com sugestão, metas e depósito, bloco do painel e navegação nova.
- **E2E:**
  - definir um limite, lançar uma despesa e ver "Perto do limite" ou "Estourou";
  - criar uma meta, depositar e ver o percentual;
  - nenhuma rolagem horizontal a 360 px.

## 9. Fora do escopo

Notificações (sub-projeto 5); limite diferente por mês; rendimento ou inflação nas metas; metas ligadas a contas; categorias "essenciais"; plano de 4 baldes (`finance-psychology`), que fica para os relatórios.

## 10. Critérios de aceite

1. Com limite de R$ 500 em Alimentação, uma despesa paga de R$ 300 e uma pendente de R$ 150 no mês mostram R$ 450 de R$ 500 e "Perto do limite" (90%).
2. Uma despesa a mais de R$ 100 mostra "Estourou" (110%), e o painel conta 1 categoria estourada.
3. A sobra planejada é igual às receitas do mês menos o orçamento total.
4. Uma meta de R$ 6.000 com R$ 1.500 guardados mostra 25% e o aporte mensal até o prazo.
5. Uma retirada maior que o guardado é recusada com mensagem clara.
6. Nenhuma rota nova expõe dados de outro usuário.
7. CI verde (lint, typecheck, unitários, integração e E2E), com tudo no ar.
