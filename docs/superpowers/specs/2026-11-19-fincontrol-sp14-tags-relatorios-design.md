# FinControl — Sub-projeto 14: Tags nos relatórios, no PDF, no CSV e no Excel

- **Data:** 2026-11-19
- **Status:** decisões tomadas pelo agente. É a segunda parte do item 6 da tabela em `docs/pesquisa-concorrentes-2026-11-18.md`. O sub-projeto 13 pôs as tags no dia a dia; este leva as tags aos relatórios, para responder "quanto gastei com bebida este ano?" sem filtrar mês a mês.
- **Banco:** nada muda (sem migration). As tags já estão em `transactions.tags`.

## 1. Decisões

| # | Decisão | Alternativas descartadas | Motivo |
|---|---|---|---|
| H1 | **"Gastos por tag" no relatório:** para cada tag, o total das despesas pagas no período (regime de caixa, R2 do sub-projeto 4), quantos lançamentos, a participação no total de despesas, o total do período anterior e a variação (R3). | Receitas por tag também | As tags existem para entender o gasto ("estou gastando muito com bebida"). Receitas e transferências marcadas aparecem no CSV e no Excel. |
| H2 | **Um lançamento com duas tags conta inteiro nas duas.** Por isso a soma das tags pode passar do total de despesas, e a tela, o PDF e o Excel avisam. | Dividir o valor entre as tags | Dividido, o total de "bebida" não bateria com o que Lançamentos mostra ao filtrar pela tag. |
| H3 | **Quais tags aparecem:** as que têm despesa paga no período ou no anterior (a que só existiu antes entra com total 0, como as categorias em R3), do maior total para o menor. Todas, sem corte. | Só as 10 maiores | É a regra das categorias. Quem cria as tags é a pessoa, e a lista costuma ser curta. |
| H4 | **Tela:** o painel "Gastos por tag" logo depois das categorias, só quando há alguma tag na lista. Cada linha mostra "#tag", o total, a barra da participação, "8% das despesas · 3 lançamentos · antes R$ 120,00" e a variação com seta e texto. No computador, a lista ocupa duas colunas. | Painel vazio para quem não usa tags | Quem não usa tags não vê nada novo; quem usa encontra as tags perto das categorias. |
| H5 | **PDF:** a seção "Gastos por tag" depois de "Receitas por categoria", com as colunas das categorias (Tag, barra, Total, Part., Anterior e Var.) e a nota de H2, só quando há tags na lista. | PDF sem tags | O PDF é o relatório da tela (R10). |
| H6 | **CSV:** a coluna "Tags" entra **no fim**, com as tags em ordem alfabética separadas por vírgula e espaço ("bar, bebida"). Vale para receitas e transferências também. | No meio, depois de Categoria | Quem já monta planilhas a partir do CSV não vê as colunas antigas mudarem de lugar. |
| H7 | **Excel, aba Lançamentos:** a coluna "Tags" entra **depois de "Categoria"**. | No fim, como no CSV | A planilha é refeita a cada download, e as tags ao lado da categoria facilitam o filtro de texto ("contém bebida") da Tabela. |
| H8 | **Excel, aba nova "Por tag"**, depois de "Por categoria" e só quando há tags na lista de H3: Tag, Vezes, Total no período, Período anterior, Variação e Média por mês (as duas em fórmula) e Participação nas despesas. A nota repete H2, e a lista de abas do Resumo cita "Por tag". | Aba sempre presente | Sem tags, seria uma aba vazia. |

## 2. API

- `ReportDTO` ganha `expenseByTag: ReportTagDTO[]`, com `ReportTagDTO = { name, total, count, share, previous, change }`.
- `totalsByTag(userId, de, até)` no repositório dos relatórios: soma e conta as despesas pagas de cada tag (`unnest` na coluna `tags`), da pessoa, pela data de pagamento.
- `CsvRow` ganha `tags` (em ordem alfabética), usado no CSV (H6) e no Excel (H7).

## 3. Web

- `TagList` na página de relatórios (H4), com o mesmo componente de variação das categorias.

## 4. Testes

- API: os totais por tag com o período anterior, a tag que só existiu antes, o lançamento com duas tags nas duas, e receitas, transferências e pendentes fora; a coluna no CSV; a seção no PDF; a aba "Por tag" e a coluna no Excel, e o Excel sem a aba quando não há tags.
- Web: o painel com as tags e o painel ausente sem tags.
- E2E: o relatório da demo mostra "#passeios" em "Gastos por tag", e o CSV baixado tem a coluna "Tags".

## 5. Limites aceitos

- No PDF, letras fora do alfabeto latino numa tag (por exemplo, 旅行) somem, como em todo texto do PDF: a R10 do sub-projeto 4 usa as fontes padrão, que só desenham o WinAnsi. A tela, o CSV e o Excel mostram o nome inteiro. Embutir uma fonte com todos os alfabetos deixaria a função da Vercel bem maior para um caso raro num app em português (apontado pelo CodeRabbit).

## 6. Ajuste do sub-projeto 13

- Em Categorias → Tags, a quantidade de lançamentos foi para baixo do nome da tag. Ao lado dos botões, "42 lançamentos" quebrava em duas linhas a 360 px (visto na conferência em produção do sub-projeto 13).

## 7. Fora deste sub-projeto

- O assistente: `buscar_lancamentos` já filtra por tag e devolve o total.
- O resumo do mês, o painel, um filtro do relatório inteiro por tag e um link da tag no relatório para Lançamentos.
