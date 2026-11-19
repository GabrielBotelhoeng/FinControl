# FinControl — Sub-projeto 10: Gastos que se repetem todo mês

- **Data:** 2026-11-19
- **Status:** decisões tomadas pelo agente. O usuário pediu, antes de dormir, para "continuar melhorando o FinControl". É o item 4 da tabela em `docs/pesquisa-concorrentes-2026-11-18.md` (assinaturas detectadas, como na Monarch e na Copilot).
- **Banco:** nada muda (sem migration).

| # | Decisão | Motivo |
|---|---|---|
| S1 | **Repetido:** mesma descrição normalizada (sem números e pontuação, como na importação), em pelo menos 3 meses diferentes, uma vez por mês, com valores a até 15% da mediana. O valor mensal é a média dos 3 últimos. | Pega assinaturas que mudam um pouco de preço e ignora o mercado (valor variável) e a padaria (várias vezes no mês). |
| S2 | **Ordem:** do mais caro ao mais barato, com o custo do ano (× 12). Mostra se já é uma recorrência cadastrada. | O custo anual é o que faz a pessoa repensar. |
| S3 | **`GET /repeated`:** despesas pagas dos últimos 6 meses, inclusive no cartão, sem as parcelas de compra, empréstimo e acordo. | As parcelas têm fim e já aparecem em outras telas. |
| S4 | **Tela:** o bloco "Gastos que se repetem todo mês" no Resumo do mês, com o total do ano. Só aparece quando há algum. | É onde a pessoa já revisa o mês. |
