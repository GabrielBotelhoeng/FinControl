# FinControl — Exportação em Excel para análise

- **Data:** 2026-11-18
- **Status:** escopo combinado com o usuário em 2026-11-18. Ele pediu "Excel primeiro, depois a IA" e quer análises que deem consciência do gasto ("estou gastando muito com bebida alcoólica"). As análises abaixo foram as ideias aceitas.
- **Base:** completa o sub-projeto 4 (relatórios e exportação). Usa as mesmas regras R1–R6 (período de 1 a 24 meses, regime de caixa, dívidas). **Sem migration.**

## 1. Objetivo

Um arquivo `.xlsx` de verdade, pronto para filtrar, montar tabela dinâmica e mexer nos números, com abas que respondem "onde o dinheiro está indo sem eu perceber".

## 2. Decisões

| # | Decisão | Alternativas descartadas | Motivo |
|---|---|---|---|
| E1 | **Gerado na API com `exceljs`**, em `GET /reports/export.xlsx?from&to`, com o mesmo período e as mesmas validações do relatório. O `uuid` do `exceljs` foi forçado para a versão 11 (`overrides`), sem o alerta da 8. | Montar no navegador (SheetJS) | Mesmo lugar e mesmas regras do PDF e do CSV, e dá para testar na API. |
| E2 | **Abas:** Resumo, Lançamentos, Por categoria, Mensal, Onde o dinheiro vai, Dia da semana, Pequenos gastos, Fixos e variáveis, Dívidas e Saldos. A aba "Ano contra ano" entra quando o período tem até 12 meses (o ano anterior cabe na consulta). | Uma aba só | Cada pergunta numa aba. A aba Lançamentos fica crua, para quem quer montar a própria análise. |
| E3 | **Lançamentos como Tabela do Excel**, com filtro em cada coluna, cabeçalho fixo, valores em R$ e as colunas Data, Mês, Dia da semana, Descrição, Tipo, Categoria, Natureza, Conta, Conta de destino, Situação e Valor. Pagas e pendentes, como no CSV (R9). | Faixa de células comum | A Tabela já vem pronta para tabela dinâmica e segmentação. |
| E4 | **Fórmulas onde a pessoa vai querer mexer:** variação na aba Por categoria, saldo e taxa de poupança na Mensal, totais nas somas. O valor calculado também vai gravado na célula. | Só valores | Muda um número e o resto acompanha. O valor gravado garante que o arquivo abre certo em leitores que não recalculam. |
| E5 | **Onde o dinheiro vai:** despesas pagas agrupadas pela descrição normalizada (sem acento, sem maiúsculas, sem números de parcela como "(3/10)"), com quantas vezes, total, média, categoria mais comum e última data. Ordem pelo total, até 50 linhas. | Agrupar só por categoria | É aqui que aparecem "Bar do Zé 12x" ou "Cerveja 9x", mesmo sem uma categoria própria. |
| E6 | **Antes e agora** (na aba Por categoria): média mensal da categoria no período contra a média dos 3 meses anteriores ao início. Subida acima de 20% ganha destaque. | Só o período anterior de mesmo tamanho | Num relatório de um mês, a média de 3 meses é uma comparação mais justa. |
| E7 | **Dia da semana:** total, quantidade e média por dia, e o resumo "fim de semana × dias úteis" pela média diária (o total dividido pelo número desses dias no período). | Total simples | O fim de semana tem 2 dias e os dias úteis 5: sem dividir, a comparação engana. |
| E8 | **Pequenos gastos:** despesas pagas abaixo de R$ 50, somadas por categoria, com o total do período e quanto isso dá por mês. | — | O "efeito cafezinho": cada um parece nada, a soma não. |
| E9 | **Fixos e variáveis:** soma das despesas pagas por natureza (fixa, variável, sem natureza) e a participação de cada uma. | — | Mostra quanto do gasto dá para cortar no curto prazo. |
| E10 | **Na tela de relatórios**, o botão "Baixar Excel" entra ao lado de "Baixar PDF" e "Baixar CSV". O nome do arquivo é `fincontrol-analise-AAAA-MM.xlsx` (ou `AAAA-MM_AAAA-MM`). | Trocar o CSV pelo Excel | O CSV continua útil para outros programas. |

## 3. Testes

- **Funções puras** (`report-analysis.ts`): normalização da descrição, agrupamento, dia da semana com média diária, pequenos gastos, fixos e variáveis, antes e agora.
- **API:** o arquivo abre no `exceljs`, com as abas, a Tabela, as fórmulas e os valores do cenário; período validado; isolamento.
- **Web:** o botão baixa com o nome certo.
- **E2E:** baixar o Excel pela demo e abrir.

## 4. Critérios de aceite

1. Com "Cerveja" paga 3 vezes (R$ 20, R$ 30 e R$ 25) e "cerveja (2/3)", a aba Onde o dinheiro vai mostra uma linha "Cerveja" com 4 vezes.
2. A aba Lançamentos é uma Tabela do Excel com filtro.
3. Mudar um valor na aba Por categoria muda a variação (fórmula).
4. O arquivo abre no Excel, no LibreOffice e no Google Planilhas.
5. CI verde e tudo no ar.
