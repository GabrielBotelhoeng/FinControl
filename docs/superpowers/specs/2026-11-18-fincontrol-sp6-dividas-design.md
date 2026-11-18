# FinControl — Sub-projeto 6: Dívidas com credores

- **Data:** 2026-11-18
- **Status:** decisões tomadas pelo agente, a pedido do usuário ("pode fazer a parte 2", depois de ver o que faltava da ideia original). Cada decisão traz o motivo.
- **Origem:** seção 03 (Gestão de dívidas) de `Ideia Projeto.txt`. Cartões (sub-projeto 2, Parte A) e empréstimos com banco (Parte B) já existem. Falta a dívida com **qualquer credor**: loja, pessoa, conta de consumo atrasada, imposto, banco sem contrato de parcelas fixas.
- **Base de domínio:** skills `debt-management` (registro do credor, valor original × atualizado, histórico de contatos, acordo com entrada e parcelas) e `lending`.

## 1. Objetivo

A pessoa cadastra uma dívida com o credor, o valor original e desde quando deve. Depois ela pode:

- **atualizar o valor** quando o credor manda um novo saldo, com juros e multa;
- **registrar uma negociação**, como uma ligação, uma proposta ou uma conversa;
- **fechar um acordo** com entrada e parcelas, que viram lançamentos pendentes como as parcelas de empréstimo;
- **registrar pagamentos**;
- e ver o **progresso de quitação**.

| Pedido da seção 03 | Como entra |
|---|---|
| Cadastro de credores | Nome do credor e tipo (V2) em cada dívida. |
| Valor original e valor atualizado | Valor original no cadastro, e "Atualizar valor" a qualquer momento (V4). |
| Juros e multas | Toda subida do valor numa atualização conta como juros e multas (V6). |
| Quantidade de parcelas e data de vencimento | No acordo (V7): entrada, número de parcelas, valor da parcela e 1º vencimento. |
| Registro de pagamentos | Pagamento avulso (V8) ou parcelas do acordo pagas em Lançamentos. |
| Histórico de negociações | Linha do tempo com atualizações, negociações, acordos e pagamentos (V5). |
| Progresso de quitação | Barra com pago ÷ (pago + saldo) e a situação (V9). |

## 2. Decisões

| # | Decisão | Alternativas descartadas | Motivo |
|---|---|---|---|
| V1 | **Tabelas novas `debts` e `debt_events`, e a coluna `transactions.debt_id`.** Os pagamentos são lançamentos de despesa com `debtId`, como as parcelas de empréstimo (`loanId`). | Tabela própria de pagamentos | O pagamento sai de uma conta e precisa aparecer no fluxo de caixa, no orçamento e nos relatórios. Como lançamento, isso já acontece. |
| V2 | **Tipo do credor:** banco ou financeira, loja ou crediário, conta de consumo (luz, água, telefone), imposto ou taxa, pessoa, outro. Só serve para o ícone e o filtro. | Lista de credores à parte | Uma pessoa raramente tem duas dívidas com o mesmo credor. Um texto livre com o tipo resolve. |
| V3 | **O saldo é calculado, nunca guardado.** As "âncoras" são as atualizações de valor e os acordos, cada uma com data e um valor. Saldo numa data `t` = valor da última âncora até `t` − pagamentos feitos depois dela, até `t`. O mínimo é 0. Antes da primeira âncora, a dívida vale 0. "Depois da âncora" compara a data de pagamento e, no mesmo dia, o momento do registro. | Saldo numa coluna, mudado a cada pagamento | Apagar ou editar um pagamento em Lançamentos não desarruma nada. O relatório calcula o saldo no fim de qualquer mês com a mesma regra. |
| V4 | **Cadastro = duas âncoras quando o valor de hoje é diferente do original:** o valor original na data "deve desde", e o valor de hoje na data de hoje. "Atualizar valor" cria uma âncora com a data de hoje. A data das âncoras novas é sempre a de hoje (definida pelo servidor). | Atualização com data livre | Com datas que só andam para a frente, a regra V3 não tem casos ambíguos. |
| V5 | **Negociação** = evento com texto (até 280 caracteres) e um valor opcional, como "ofereceram R$ 900 à vista". Não mexe no saldo. A linha do tempo junta eventos e pagamentos, do mais novo ao mais antigo. | Campo de observação único | A seção pede histórico, e um campo só perde a ordem das conversas. |
| V6 | **Juros e multas e descontos.** Em cada âncora depois da primeira, a diferença entre o valor novo e o saldo logo antes dela: se o valor subiu, entra em juros e multas; se caiu, entra em descontos. O desconto do acordo entra aqui. A identidade que fecha a conta é: saldo = original + juros e multas − descontos − pago. | Taxa de juros informada | A pessoa sabe o valor que o credor cobra, mas raramente sabe a taxa. |
| V7 | **Acordo:** entrada (opcional, paga hoje na conta escolhida), número de parcelas (1 a 120), valor da parcela, 1º vencimento (de hoje até daqui a 1 ano) e a conta que paga. O total é entrada + parcelas × valor. O acordo é uma âncora com esse total, e as parcelas viram lançamentos pendentes "Acordo {nome} (k/N)", na categoria "Dívidas e acordos" (criada se faltar, como a de empréstimos). Com um acordo ativo, não dá para fechar outro, atualizar o valor nem pagar avulso (422). "Cancelar acordo" apaga as parcelas pendentes e cria uma atualização com o saldo do momento. | Acordo sem lançamentos | As parcelas aparecem no "A pagar", nos avisos de vencimento e no orçamento sem código novo. |
| V8 | **Pagamento avulso** (sem acordo): valor, data (entre a data da última âncora e hoje) e conta. Vira um lançamento pago "Pagamento {nome}". Ele pode ser editado ou apagado em Lançamentos, e o saldo acompanha (V3). As parcelas do acordo seguem a regra das de empréstimo: não podem ser apagadas nem mudar de valor em Lançamentos. | Pagamento só pela página da dívida | A pessoa corrige um erro onde ela vê o lançamento. |
| V9 | **Situação:** "Quitada" (saldo 0), "Em acordo" (última âncora é um acordo), "Em atraso" (em acordo com parcela vencida) e "Em aberto" (o resto). A lista mostra primeiro as não quitadas, do maior saldo ao menor, e depois as quitadas. | Situação escolhida à mão | A situação sai dos números e não fica desatualizada. |
| V10 | **Excluir a dívida** apaga as parcelas pendentes e os eventos. Os pagamentos já feitos ficam em Lançamentos, sem o vínculo (FK `SET NULL`), como no empréstimo. | Proibir excluir com pagamento | É o mesmo comportamento do empréstimo, que a pessoa já conhece. |
| V11 | **Total de dívidas:** `DebtsDTO` ganha `others` (as dívidas deste módulo), somado ao total do painel, à evolução das dívidas do relatório, ao PDF, ao Excel e à ferramenta do assistente. A ferramenta lista cada dívida com o credor, a situação, o saldo e os juros e multas, para a IA poder sugerir a ordem de quitação (seção 08). | Total separado | "Total de dívidas" sem estas dívidas estaria errado. |
| V12 | **Navegação:** "Dívidas" em `/dividas` e `/dividas/:id`, no menu do computador e no Perfil, como "Empréstimos". O indicador de dívidas do painel ganha o link "Ver dívidas". A barra do celular continua com 6 itens (P9). | 7 itens | 7 itens não cabem a 360 px. |
| V13 | **Demo:** "Conta de luz atrasada" em aberto, com juros, e "Crediário da loja de móveis" em acordo, com a entrada e uma parcela pagas. | Demo sem dívidas | A página não pode abrir vazia na demo. |

## 3. Regras (funções puras em `packages/shared/src/debt.ts`, com testes)

- **`debtBalanceAt(input, date)`:** a regra V3. A entrada é `{ anchors: [{ date, recordedAt, amount }], payments: [{ date, recordedAt, amount }] }`.
- **`debtSummary(input, today)`:** a partir das mesmas entradas, devolve `{ original, interest, discounts, paid, balance, fraction }`, com a regra V6. `fraction` = pago ÷ (pago + saldo), ou 1 quando os dois são 0.
- **`debtStatus({ balance, lastAnchorIsAgreement, hasOverdueInstallment })`:** a regra V9.

## 4. API (`/api/v1/debts`)

- `GET /` lista as dívidas com o resumo e a situação.
- `POST /` cria uma dívida com `{ name, creditor, kind, originalAmount, since, currentAmount? }`. A data `since` não pode estar no futuro.
- `GET /:id` devolve o detalhe: o resumo, o acordo ativo com as parcelas e a linha do tempo.
- `PATCH /:id` muda só o nome, o credor ou o tipo.
- `DELETE /:id` segue a regra V10.
- `POST /:id/valuations` recebe `{ amount, note? }` (V4).
- `POST /:id/notes` recebe `{ text, amount? }` (V5).
- `POST /:id/agreement` recebe `{ downPayment, installments, installmentAmount, firstDueDate, accountId }` (V7).
- `DELETE /:id/agreement` cancela o acordo (V7).
- `POST /:id/payments` recebe `{ amount, date, accountId }` (V8).

A conta que paga não pode ser cartão nem estar arquivada (422), como no empréstimo. Uma conta com parcela de acordo pendente não pode ser arquivada.

## 5. Web

- **`/dividas`:** cabeçalho com o total devido, o total pago e os juros e multas. A lista mostra um cartão por dívida, com o ícone do tipo, o nome, o credor, o saldo, o selo da situação e a barra de progresso. O botão "Nova dívida" fica no topo.
- **`/dividas/:id`:** os números da regra V6 em blocos e a barra de progresso. As ações são "Atualizar valor", "Registrar negociação", "Fechar acordo" ou "Cancelar acordo", "Registrar pagamento", "Editar" e "Excluir". O acordo ativo aparece com as parcelas e o vencimento de cada uma, e a linha do tempo fica no fim.
- **Quando a tela tem 360 px**, nada pode transbordar. O teste de 360 px passa a cobrir `/dividas` e `/dividas/:id`.

## 6. Limites aceitos

- Um pagamento editado em Lançamentos para uma data anterior à última âncora deixa de contar no saldo de hoje, porque a regra V3 o considera já incluído naquela âncora. Pela página da dívida, isso é impedido (V8).
- A soma das parcelas do acordo pode diferir do valor que o credor cobra na última parcela, por arredondamento. A pessoa corrige o valor depois do acordo com "Cancelar acordo" e "Atualizar valor".
