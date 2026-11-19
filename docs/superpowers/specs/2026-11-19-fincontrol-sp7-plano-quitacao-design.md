# FinControl — Sub-projeto 7: Plano de quitação

- **Data:** 2026-11-19
- **Status:** decisões tomadas pelo agente, a pedido do usuário ("pode fazer tudo que você disse"). Item 1 da recomendação em `docs/pesquisa-concorrentes-2026-11-18.md`.
- **Origem:** seção 08 da ideia original ("criar sugestões de quitação de dívidas"). Referência: o simulador de quitação do YNAB e a skill `debt-management` (avalanche × bola de neve).
- **Banco:** nada muda. É uma tela que simula a partir de `/loans` e `/debts`, sem migration.

## Decisões

| # | Decisão | Motivo |
|---|---|---|
| Q1 | **O que entra:** empréstimos (saldo devedor, taxa real e parcela), dívidas em acordo (saldo, parcela do acordo e juros 0, porque o acordo fixa o valor) e dívidas em aberto (saldo, com os juros e a parcela informados pela pessoa na própria tela; sem nada informado, vale 0). Compras parceladas no cartão ficam de fora, porque não têm juros. | Só a pessoa sabe os juros de uma dívida em aberto. Para não precisar de migration, eles ficam guardados no navegador (`localStorage`). |
| Q2 | **Valor mensal:** começa pela soma das parcelas (o mínimo). Abaixo dele, a tela avisa e não simula. | Abaixo do mínimo, alguma parcela atrasaria, e o plano deixaria de ser realista. |
| Q3 | **Estratégias:** avalanche (maior juros primeiro; empate: menor saldo), bola de neve (menor saldo primeiro; empate: maior juros) e "só o mínimo" para comparar. A de menos juros entre as que quitam ganha o selo "Menos juros". | São as duas estratégias clássicas, e "só o mínimo" mostra o custo de não fazer nada. |
| Q4 | **Simulação mensal** (`simulatePayoff` em `packages/shared/src/payoff.ts`): primeiro os juros do mês sobre o saldo, depois a parcela de cada dívida e por fim a sobra para a dívida da vez. A sobra de uma dívida quitada passa para a próxima no mesmo mês. Limite de 600 meses ("não quita"). | É o modelo do simulador de qualquer banco. O limite evita laço infinito quando os juros passam do pagamento. |
| Q5 | **Tela `/dividas/plano`**, aberta pelo botão "Plano de quitação" em Dívidas. Tem o valor mensal, os dados das dívidas em aberto, os 3 cartões (data de quitação, meses e juros), a frase de economia contra "só o mínimo", o gráfico do saldo devedor ao longo do tempo (até 10 anos) e a ordem de quitação da estratégia escolhida. | A comparação lado a lado é o que ajuda a decidir. |

## Revisão final (revisor novo)

- **Dívida que não quita:** a simulação para quando o saldo passa de R$ 10 bilhões. O cartão diz "Os juros crescem mais que o pagamento" em vez de um total de juros sem sentido, e o gráfico mostra só as estratégias que quitam. A taxa digitada vai até 30% ao mês.
- **Mês a mais:** os saldos ficam em centavos fracionários, e um resto abaixo de R$ 1 é pago junto, como a última parcela do banco. O empréstimo só com a parcela termina exatamente nas parcelas que faltam (teste com `outstandingBalance`).
- **Início:** o plano começa neste mês quando há parcela vencendo nele.
- **Mínimo:** considera os juros do 1º mês.
- **Ordem:** nos empates, a da estratégia.
- **Acordo atrasado:** a tela avisa que o vencido não entra no mínimo.
- **360 px:** o seletor de estratégia saiu, porque os próprios cartões escolhem.
- **Leitor de tela:** os cartões usam o texto visível, com o selo "Menos juros".
- **Navegador:** os dados guardados são conferidos ao carregar, e os de dívidas que não estão mais em aberto são descartados.
