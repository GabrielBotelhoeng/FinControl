# FinControl — Sub-projeto 4: Relatórios e exportação

- **Data:** 2026-11-17
- **Status:** decisões tomadas pelo agente. Em 2026-11-15, o usuário pediu "não me pergunte mais, me entregue o projeto pronto". Cada decisão abaixo traz o motivo para revisão posterior.
- **Origem:** seção 07 (Relatórios) e o que faltava da seção 01 (Dashboard financeiro, "Total de dívidas") de `Ideia Projeto.txt`. No roadmap original (spec do sub-projeto 1, seção 1.1), é o item 5, "Relatórios e exportação (PDF/CSV) + dashboard completo".
- **Base de domínio:** skills `client-reporting-delivery` (estrutura do relatório: resumo, evolução, detalhamento e notas) e `irpf-brasil` (saldo de cada conta no fim do período, que serve para "Bens e Direitos"), em `docs/skills-no-fincontrol.md`, seção 5.
- **Banco:** nenhuma tabela nova. Tudo sai dos lançamentos, contas e empréstimos que já existem, então **não há migration**.

## 1. Objetivo

A pessoa escolhe um período e vê **para onde foi o dinheiro, como as receitas evoluíram, como as dívidas evoluíram e o que mudou em relação ao período anterior**. Ela pode baixar o relatório em PDF e os lançamentos em CSV.

O que a seção 07 pede, e como entra:

| Pedido | Como entra |
|---|---|
| Gastos por categoria | Tabela com total, participação e variação contra o período anterior. |
| Evolução de receitas | Série mensal de receitas, despesas e saldo do mês. |
| Evolução das dívidas | Série mensal com a dívida de cartões, a de empréstimos e o total no fim de cada mês. |
| Comparação mensal | Totais e categorias comparados com o período anterior de mesmo tamanho. |
| Exportação em PDF e CSV | PDF do relatório gerado na API; CSV dos lançamentos do período. |

A seção 01 pede "Total de dívidas" no painel. Ele entra como um indicador novo (R8).

## 2. Decisões

| # | Decisão | Alternativas descartadas | Motivo |
|---|---|---|---|
| R1 | **Período = intervalo de meses (`from`, `to`, AAAA-MM), de 1 a 24 meses.** A tela oferece três atalhos: "Mês", "Ano" e "Últimos 12 meses". `to` não pode passar do mês atual (422). | Datas livres; só mês | Os números do app são mensais (orçamento, painel). 24 meses cobre a comparação de um ano com o anterior sem consultas pesadas. |
| R2 | **Regime de caixa: só o que foi pago, pela data de pagamento**, igual ao painel. Compras no cartão contam na data de cada parcela (C1 do sub-projeto 2). Transferências ficam de fora. Pendentes ficam de fora do relatório, mas entram no CSV com a situação. | Contar pendentes | O relatório mostra o que aconteceu. As pendentes já aparecem no planejamento e no "A pagar". |
| R3 | **Comparação contra o período anterior de mesmo tamanho**: um mês contra o mês anterior, um ano contra o ano anterior. A variação é `null` quando o anterior é zero (a tela mostra "novo" em vez de um percentual infinito). | Mesmo mês do ano anterior | É a leitura mais direta de "comparação mensal" e funciona para qualquer tamanho de período. |
| R4 | **Séries mensais com no mínimo 6 meses**, terminando em `to`. Num relatório de um mês, os gráficos mostram os 6 meses até ele. | Série só do período | Um gráfico de um ponto não mostra evolução. |
| R5 | **Dívida de cartão no fim de um mês** = compras no cartão (com as parcelas futuras de uma compra já feita) − pagamentos e estornos no cartão, até aquela data. Mínimo 0 por cartão, cartões arquivados incluídos. A compra parcelada vira dívida inteira na data da 1ª parcela. | Só as faturas abertas | A parcela futura já é dívida contratada. Os cartões arquivados entram porque ainda podem ter fatura a pagar (R16 do sub-projeto 2). |
| R6 | **Dívida de empréstimo no fim de um mês** = saldo devedor pela tabela Price (`outstandingBalance`, o mesmo da tela do empréstimo) com as parcelas pagas até aquela data. As parcelas pagas antes do cadastro contam como pagas no vencimento. Antes do mês anterior à 1ª parcela, o empréstimo não existia e vale 0. | Soma nominal das parcelas restantes | É o mesmo número que a tela do empréstimo mostra ("quitação estimada"). A soma nominal inclui juros que ainda não existem. |
| R7 | **Conteúdo do relatório** (skill `client-reporting-delivery`): resumo (receitas, despesas, saldo do período, taxa de poupança e comparação), gastos por categoria, receitas por categoria, evolução mensal, evolução das dívidas, as 10 maiores despesas e o saldo de cada conta no fim do período (skill `irpf-brasil`). O relatório termina com uma nota que explica as regras R2, R5 e R6. | Relatório só com gráficos | A estrutura da skill separa resumo, evolução, detalhe e notas. O saldo por conta no fim do ano é o que a declaração do IR pede. |
| R8 | **Painel completo:** um indicador "Total de dívidas" (cartões + empréstimos hoje, pelas regras R5 e R6), com a divisão entre cartões e empréstimos. O painel ganha também um link "Ver relatórios". `/dashboard/summary` ganha `debts: { cards, loans, total }`. | Só no relatório | A seção 01 pede o total de dívidas no painel. |
| R9 | **CSV dos lançamentos do período**, por data de competência (data de pagamento, ou vencimento quando pendente), no padrão do Excel brasileiro: separador `;`, vírgula decimal, datas `dd/mm/aaaa`, UTF-8 com BOM. As colunas são Data, Descrição, Tipo, Categoria, Conta, Conta de destino, Situação e Valor. Receitas ficam positivas e despesas negativas. Um texto que comece com `=`, `+`, `-` ou `@` ganha um apóstrofo na frente, contra a injeção de fórmulas. | Vírgula como separador | Com `;` e vírgula decimal, o Excel em português abre o arquivo sem assistente de importação. |
| R10 | **PDF gerado na API com `pdf-lib`**: JavaScript puro, com as fontes padrão (Helvetica) embutidas na biblioteca, sem ler arquivos do disco. Funciona na função da Vercel. A4, com tabelas e barras desenhadas. Caracteres fora do WinAnsi (emojis, "−") viram equivalentes ou somem. | PDF no navegador (jsPDF); "imprimir como PDF" | O arquivo sai igual em qualquer aparelho e pode ser testado na API. O `pdfkit` lê arquivos de fonte do disco em tempo de execução, o que é frágil no empacotamento da Vercel. |
| R11 | **Downloads pela web:** `fetch` com o token, `Blob` e um link temporário. O nome do arquivo é `fincontrol-relatorio-AAAA-MM_AAAA-MM.pdf` ou `fincontrol-lancamentos-AAAA-MM_AAAA-MM.csv`, ou só `AAAA-MM` quando o período tem um mês. | Link direto com token na URL | O token nunca vai para a URL nem para o histórico. |
| R12 | **Navegação:** "Relatórios" entra no menu do computador. A barra do celular continua com 6 itens (P9 do sub-projeto 3). No celular, o acesso fica pelo link do painel e pelo Perfil. | 7 itens na barra | 7 itens não cabem a 360 px. |
| R13 | **Pendências do sub-projeto 3:** (a) ao juntar categorias, o limite da categoria de origem passa para a de destino quando ela não tem limite. Quando as duas têm, o destino fica com o dele, e o diálogo avisa antes. (b) `PUT /budgets/:categoryId` devolve o id gravado no banco, e não o texto cru da URL. | Deixar como está | O usuário pediu as duas correções junto com este sub-projeto (2026-11-17). |

## 3. Regras (funções puras em `packages/shared/src/reports.ts`, com testes)

- **`reportPeriod(from, to)`:** devolve `{ months, previousFrom, previousTo }`. Recusa `to < from` e mais de 24 meses.
- **`seriesMonths(from, to)`:** a lista de meses das séries. Tem pelo menos 6 meses e termina em `to` (R4).
- **`changeRatio(current, previous)`:** `null` quando `previous` é 0. Senão, `(current − previous) ÷ previous`.
- **`cardDebtAt(card, date)`:** R5. A entrada é `{ initialBalance, charges: [{ amount, startDate }], credits: [{ amount, date }] }`.
- **`loanOutstandingAt(loan, date)`:** R6. A entrada é `{ installmentAmount, monthlyRate, installmentsTotal, installmentsPaidBefore, firstDueDate, paidDates }`.
- **`csvCell(text)` e `toCsv(rows)`:** R9 (escape de `;`, aspas e quebras de linha, e a proteção contra fórmulas).
- **`pdfSafe(text)`:** R10. Troca o que o WinAnsi não tem (`−` → `-`, espaço fino → espaço) e tira o resto (emojis).

## 4. API (`/api/v1`)

- **`GET /reports?from=AAAA-MM&to=AAAA-MM`** devolve o `ReportDTO`:
  - `period: { from, to, months, previousFrom, previousTo }`;
  - `totals: { income, expense, net, savingsRate, previousIncome, previousExpense, incomeChange, expenseChange }`;
  - `expenseByCategory` e `incomeByCategory`: `[{ categoryId, name, icon, color, total, share, previous, change }]`, com as categorias só do período anterior incluídas com total 0;
  - `monthly: [{ month, income, expense, net }]` e `debts: [{ month, cards, loans, total }]`, nos meses de `seriesMonths`;
  - `topExpenses`: as 10 maiores despesas pagas (`id`, `date`, `description`, `category`, `account`, `amount`);
  - `balances: { items: [{ accountId, name, type, balance }], total }`: saldo de cada conta não arquivada, exceto cartões, no fim de `to`.
- **`GET /reports/export.csv?from&to`:** `text/csv; charset=utf-8`, com `Content-Disposition: attachment`.
- **`GET /reports/export.pdf?from&to`:** `application/pdf`, com `Content-Disposition: attachment`.
- **Validação:** `from` e `to` obrigatórios. `to < from`, mais de 24 meses ou `to` depois do mês atual dão 422.
- **`/dashboard/summary`** ganha `debts: { cards, loans, total }` (R8).
- **Isolamento:** tudo filtra por `userId`.

## 5. Telas

- **`/relatorios`:**
  - os seletores "Mês", "Ano" e "Últimos 12 meses", com o mês ou ano escolhido;
  - os botões "Baixar PDF" e "Baixar CSV", com estado de carregando e mensagem de erro;
  - o resumo em cartões (receitas, despesas, saldo, taxa de poupança), cada um com a variação contra o período anterior (ícone e texto, nunca só cor);
  - gastos por categoria: barra, total, participação e variação;
  - receitas por categoria;
  - gráfico "Evolução mensal" (receitas e despesas em barras, saldo do mês em linha);
  - gráfico "Evolução das dívidas" (cartões e empréstimos);
  - tabela "Maiores despesas";
  - tabela "Saldo das contas em dd/mm/aaaa";
  - a nota sobre as regras;
  - estado vazio quando o período não tem lançamentos.
- **Painel:** o indicador "Total de dívidas" (R8) e o link "Ver relatórios".
- **Perfil:** o link "Relatórios".
- **Navegação:** R12.
- **Categorias:** o aviso de R13 (a) no diálogo de excluir com troca.

## 6. Demo

A demo já tem 6 meses de histórico, cartão, financiamento, receitas e despesas em várias categorias. O relatório sai completo sem mudar o seed. O teste da demo confere que a evolução das dívidas tem valores nos dois tipos.

## 7. Testes

- **Domínio:** período e período anterior (virada de ano, limite de 24), meses da série, variação, dívida de cartão (compra parcelada, pagamento, estorno, mínimo 0), saldo de empréstimo (antes de existir, com parcelas pagas antes do cadastro, quitado), CSV (escape e fórmula) e `pdfSafe`.
- **API (Postgres real):**
  - totais e comparação;
  - categorias com a do período anterior;
  - séries;
  - dívidas com cartão parcelado e empréstimo;
  - maiores despesas e saldos;
  - validação do período;
  - CSV (cabeçalho, BOM, valores, pendentes);
  - PDF (começa com `%PDF`, abre no `pdf-lib`, tem páginas);
  - `debts` no painel;
  - isolamento;
  - R13 (a) e (b).
- **Web:** a página com os três atalhos, o estado vazio, os downloads (`fetch` com token gerando o arquivo), o indicador do painel e a navegação.
- **E2E:** abrir os relatórios pela demo e ver os números; baixar o CSV e o PDF; nenhuma rolagem horizontal a 360 px.

## 8. Fora do escopo

Relatório agendado ou enviado por e-mail (vai para notificações); filtros por conta ou categoria no relatório; Excel nativo (`.xlsx`); gráficos dentro do PDF além das barras; regime de competência.

## 9. Critérios de aceite

1. Com R$ 5.000 de receita e R$ 3.000 de despesa pagas no mês, e R$ 4.000 e R$ 2.000 no mês anterior, o relatório mostra saldo de R$ 2.000, taxa de poupança de 40%, receitas +25% e despesas +50%.
2. Uma compra de R$ 1.200 em 12x no cartão aparece como R$ 1.200 de dívida de cartão no fim do mês da compra. Depois de pagar a primeira fatura de R$ 100, a dívida cai para R$ 1.100.
3. O saldo do empréstimo na evolução, no mês atual, é o mesmo "saldo devedor" da tela do empréstimo.
4. O CSV abre no Excel em português com acentos e valores certos. Uma descrição `=SOMA(A1)` sai como `'=SOMA(A1)`.
5. O PDF baixa, abre e tem o resumo, as categorias e as dívidas.
6. O painel mostra "Total de dívidas" igual a cartões + empréstimos.
7. Nenhuma rota nova expõe dados de outro usuário.
8. CI verde (lint, typecheck, unitários, integração e E2E), com tudo no ar.
