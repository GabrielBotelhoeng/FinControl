# FinControl — Sub-projeto 11: Patrimônio líquido

- **Data:** 2026-11-19
- **Status:** decisões tomadas pelo agente. O usuário pediu para continuar de onde parou; é o item 2 da tabela em `docs/pesquisa-concorrentes-2026-11-18.md` (patrimônio líquido com a evolução mês a mês, como na Monarch).
- **Banco:** migration nova (tabelas `assets` e `asset_valuations`). **Antes do deploy da API, aplicar no Supabase.**

## 1. Objetivo

Mostrar quanto a pessoa vale hoje, em dinheiro: **tudo o que ela tem menos tudo o que ela deve**, e como esse número mudou nos últimos 12 meses. As contas e as dívidas já existem no app; falta cadastrar os **bens** que não são contas, como imóvel, carro, previdência ou dinheiro emprestado a alguém, com o valor atualizado à mão.

## 2. Decisões

| # | Decisão | Alternativas descartadas | Motivo |
|---|---|---|---|
| B1 | **Patrimônio líquido = contas + bens − dívidas.** Contas: saldo das contas não arquivadas, sem cartões (a regra R7 dos saldos do relatório; saldo negativo de conta corrente entra negativo), mais o crédito dos cartões pagos a mais (seção 8). Bens: o valor de cada bem (B3). Dívidas: o total do painel (cartões R5, empréstimos R6 e credores V11), pelas mesmas funções. | Somar o saldo da conta do cartão | Cada parte já tem regra testada. O cartão entra só como dívida; somar também o saldo dele contaria a mesma dívida duas vezes. |
| B2 | **Tabelas novas `assets` (nome, tipo) e `asset_valuations` (data, valor).** O valor nunca fica guardado no bem. | Coluna `value` no bem | A evolução precisa do valor em cada data. É a mesma ideia das âncoras das dívidas (V3). |
| B3 | **Valor numa data `t`** = o do registro mais recente com data até `t` (no mesmo dia, vale o último gravado). Antes do primeiro registro, o bem vale 0. | Interpolar entre registros | O valor de um bem só muda quando a pessoa diz. Interpolar inventaria números. |
| B4 | **Tipos:** imóvel, veículo, investimento, dinheiro a receber e outro bem. Só servem para o ícone e o rótulo. O formulário avisa que um investimento que já é conta do tipo "Investimento" entra pelo saldo da conta. | Lista longa de tipos | Cinco tipos cobrem o que uma pessoa física tem. |
| B5 | **Cadastro:** nome, tipo, valor hoje e "desde quando você tem" (padrão: hoje; não pode estar no futuro nem antes de 1900). Com uma data no passado, grava o registro dessa data com o "valor na compra" (opcional; sem ele, o valor de hoje) e, se o valor de hoje for diferente, o registro de hoje. Com a data de hoje, o valor na compra é ignorado. | Só o valor de hoje | Sem a data, o bem pareceria ganho neste mês e o gráfico mostraria um salto. É o mesmo formato do cadastro da dívida (V4). |
| B6 | **Atualizar valor:** valor (0 ou mais) e data (até hoje, inclusive antes do primeiro registro, o que antecipa o "desde"). Valor 0 = vendeu ou perdeu o bem: ele continua na lista, no fim, e o passado continua no gráfico. Dá para excluir um registro, menos o único (422). | Data sempre de hoje, como nas dívidas | Aqui não há pagamentos para desarrumar o saldo, e completar o histórico corrige o gráfico. |
| B7 | **Excluir o bem** apaga o histórico: ele sai também dos meses passados. O diálogo avisa e sugere o valor 0 para quem quer manter o passado. | Bloquear a exclusão | A pessoa pode ter cadastrado por engano. |
| B8 | **`GET /net-worth`:** o de hoje (cada conta, cada bem e as dívidas por tipo) e a série dos 12 últimos meses, no fim de cada mês (o mês atual vai até hoje), com contas, bens, dívidas e total. Cada fonte é lida uma vez e os meses saem em memória. | Um cálculo por mês no banco | 12 meses é o período "12 meses" dos relatórios. Doze leituras de cada fonte deixariam a página lenta no plano gratuito. |
| B9 | **Painel:** o resumo ganha `netWorth`, e a linha "Patrimônio líquido R$ X · Ver patrimônio" fica abaixo da previsão do fim do mês. | Bloco novo no painel | No celular, a página não está na barra de baixo (6 itens, P9). Uma linha não empurra o resto. |
| B10 | **Navegação:** `/patrimonio` no menu do computador (depois de "Dívidas") e no Perfil. | 7 itens na barra do celular | 7 itens não cabem a 360 px. |
| B11 | **Tela `/patrimonio`:** o total de hoje e a variação desde o primeiro mês do gráfico; "O que você tem" (cada conta e os bens) e "O que você deve" (cartões, empréstimos e credores, com link para Dívidas); o gráfico dos 12 meses (barras do que tem e do que deve, esta com hachura, e a linha do patrimônio); a lista de bens, do maior valor ao menor, com o tipo, o valor, a data da última atualização e a variação desde o primeiro registro; o diálogo do bem com o histórico, "Atualizar valor", "Editar" e "Excluir". | Página por bem | Um bem tem poucos dados; o diálogo segue o das metas. |
| B12 | **Assistente:** a ferramenta `saldos_e_dividas` ganha `patrimonio_liquido` e os bens com valor (nome, tipo e valor). | Ferramenta nova | "Qual é o meu patrimônio?" cabe na ferramenta que já lê saldos e dívidas, com o contexto enxuto. |
| B13 | **Demo:** "Carro" (veículo do financiamento da demo: R$ 45.000 no início do empréstimo, R$ 42.500 há 6 meses e R$ 40.000 hoje) e "Previdência privada" (investimento: R$ 10.000 há 12 meses, R$ 11.800 há 6 meses e R$ 13.500 hoje). | Demo sem bens | A página não pode abrir vazia na demo, e o carro conversa com o financiamento. |
| B14 | **Privacidade:** a lista de dados da política passa a citar empréstimos, dívidas, metas, orçamento e bens, e a linha do assistente cita dívidas e bens. | Não mexer | A política precisa dizer o que o app guarda (LGPD). |

## 3. Regras (funções puras em `packages/shared/src/asset.ts`, com testes)

- **`assetValueAt(valuations, date)`:** a regra B3. Cada registro é `{ date, recordedAt, amount }`.
- **`assetSummary(valuations, today)`:** `{ value, since, firstValue, updatedOn }` (valor de hoje, data e valor do primeiro registro, data do último até hoje), ou `null` sem registro.
- **`netWorthDates(today, months)`:** os pontos da série, do mais antigo ao mais novo: `{ month, date }`, com o fim de cada mês e hoje no mês atual.

## 4. API

- `GET /assets` lista os bens (B11: do maior valor ao menor).
- `POST /assets` cria com `{ name, kind, value, since?, purchaseValue? }` (B5) e devolve o detalhe.
- `GET /assets/:id` devolve o bem com o histórico, do mais novo ao mais antigo.
- `PATCH /assets/:id` muda o nome ou o tipo.
- `DELETE /assets/:id` apaga o bem e o histórico (B7).
- `POST /assets/:id/valuations` recebe `{ amount, date }` (B6) e devolve o detalhe.
- `DELETE /assets/:id/valuations/:valuationId` exclui um registro; o único dá 422 (B6). A exclusão trava o bem, para dois pedidos juntos não apagarem os dois últimos.
- `GET /net-worth` devolve `{ date, accounts: { items, total }, assets: { items, total }, debts, total, series }` (B8).
- `GET /dashboard/summary` ganha `netWorth` (B9).

Data futura e data antes de 1900 dão 422 e 400. Bem de outra pessoa dá 404.

## 5. Web

- **`/patrimonio`**, com os componentes em `features/net-worth/`. As partes comuns dos gráficos (legenda, dica, eixo e hachura) saem de `report-charts.tsx` para `components/ui/chart.tsx`.
- As mutações dos bens usam `useFinanceMutation`, e `assets` e `net-worth` entram nas chaves invalidadas por qualquer mudança financeira (um lançamento muda o saldo das contas).
- **360 px:** nada pode transbordar; o teste de 360 px passa a cobrir `/patrimonio`.

## 6. Limites aceitos

- O saldo inicial de uma conta não tem data: nos meses passados, ele conta como se a conta sempre tivesse existido (a mesma regra do gráfico "Últimos 6 meses" do painel).
- O relatório, o PDF e a planilha ainda não mostram os bens. A evolução do patrimônio fica na página dele.
- O valor dos bens é o que a pessoa informa: o app não consulta a tabela FIPE nem o preço de imóveis.
- Conta arquivada com saldo sai do patrimônio no dia em que foi arquivada: o gráfico mostra a queda nesse mês. O gráfico "Últimos 6 meses" do painel e o relatório continuam com a regra R7 (só contas não arquivadas, em qualquer data).

## 7. Ordem de implementação

1. Regras e schemas no shared, com testes.
2. Migration e schema do Prisma.
3. Módulos `assets` e `net-worth` na API, `netWorth` no painel, ferramenta do assistente e demo, com testes contra o Postgres.
4. Web: página, diálogos, gráfico, menu, Perfil, painel e política, com testes.
5. E2E do patrimônio e o de 360 px.

## 8. Revisão final (revisor novo)

Nada crítico nem alto, e nenhum vazamento entre usuários. Corrigidos, cada um com teste:

- **Conta arquivada (médio):** arquivar uma conta, mesmo zerada, apagava o saldo dela de todos os meses passados e criava um salto falso no gráfico. Agora ela conta nos meses antes do dia em que foi arquivada; hoje, como no saldo total, não conta.
- **Crédito do cartão:** o que foi pago a mais no cartão (ou estornado depois do pagamento) sumia do patrimônio, porque a dívida do cartão para no zero. Agora ele soma nas contas ("Crédito nos cartões"), também no painel.
- **Venda com data antiga:** "Vendi ou perdi este bem" com uma data anterior a um valor maior que zero já registrado não zerava o bem hoje. Agora dá 422 com a explicação, e o texto de ajuda pede a data da venda.
- **Valor na compra:** com dois registros no primeiro dia, o cartão do bem usava o primeiro gravado e o gráfico o último. Agora os dois usam o último (B3).
- **Web:** o título do diálogo acompanha a edição do nome, e o botão de excluir um registro diz o valor e a data (dois registros no mesmo dia tinham o mesmo nome).
- **Desempenho:** o saldo do relatório (uma data só) voltou a ser agrupado por conta; só a série do patrimônio lê dia a dia, e só o trecho entre a primeira e a última data.
- **Testes novos:** exclusões simultâneas de registros (a trava funciona), erro ao carregar a página e a recusa da API no diálogo.
