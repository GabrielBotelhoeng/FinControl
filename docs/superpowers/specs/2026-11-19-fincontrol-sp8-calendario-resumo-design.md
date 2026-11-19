# FinControl — Sub-projeto 8: Calendário de contas e resumo do mês

- **Data:** 2026-11-19
- **Status:** decisões tomadas pelo agente, a pedido do usuário ("pode fazer tudo que você disse"). Item 2 da recomendação em `docs/pesquisa-concorrentes-2026-11-18.md`. Referências: o calendário de contas da Monarch e o resumo do mês da Copilot.
- **Banco:** nada muda (sem migration).

## Calendário (`/calendario`, `GET /calendar?month=AAAA-MM`)

| # | Decisão | Motivo |
|---|---|---|
| K1 | **Lançamentos pelo vencimento**, receitas e despesas, pagos ou não, fora de cartão. Transferências ficam de fora. As recorrências do mês são materializadas antes, como em Lançamentos. | É o que a pessoa paga ou recebe naquele dia. A compra no cartão não vence sozinha: vence a fatura. |
| K2 | **Faturas que vencem no mês** (de todos os cartões, inclusive arquivados), com o restante a pagar. Só aparecem as faturas que já existem (até a aberta). | O vencimento da fatura é a conta de verdade do cartão. |
| K3 | **Totais do mês:** a pagar, pago, a receber, recebido. A fatura entra pelo restante e pelo que já foi pago. | Responde "quanto ainda sai este mês". |
| K4 | **Tela:** grade do mês (dom a sáb) com um ponto por dia (vermelho com vencida, dourado com a pagar, verde com tudo pago, sempre com o texto no nome do botão). Ao tocar num dia, a lista abre com "Pagar" ou "Recebi" e "Ver fatura". Fica no menu do computador, no Perfil e no link "Calendário" do "A pagar" do painel. | Cor nunca sozinha: o nome acessível diz a situação. |

## Resumo do mês (`/resumo`)

| # | Decisão | Motivo |
|---|---|---|
| M1 | **Abre no mês passado**, que já fechou, com o seletor até o mês atual. É uma tela sem endpoint novo: usa `/reports` de um mês e `/budgets`. | O resumo de um mês pela metade engana. |
| M2 | **Frases (`monthInsights`):** quanto gastou contra o mês anterior, quanto sobrou e a taxa de poupança (meta de 20%), a categoria que mais subiu e a que mais caiu, a maior despesa, o orçamento (estouradas ou todas dentro) e se as dívidas subiram ou caíram. Só entra o que tem dado. | São as perguntas que a pessoa faz ao fechar o mês. |
| M3 | **Ícone com rótulo** (ponto positivo, de atenção ou informação) e cor; no fim, os links para o relatório e para o assistente. Fica no menu do computador e no Perfil. | Cor nunca sozinha. |
