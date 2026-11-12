# FinControl — Sub-projeto 2: Crédito (cartões, empréstimos e financiamentos)

- **Data:** 2026-11-12
- **Status:** Design aprovado no chat pelo usuário, seção por seção (Partes A, B e indicador/demo/testes)
- **Origem:** módulo 04 de `Ideia Projeto.txt` (cartões). Em 2026-11-12, o usuário pediu para incluir empréstimos e financiamentos ("muita gente se endivida por não saber quanto está pagando"), a comparação de taxas por banco e o indicador de endividamento.
- **Base de domínio:** skills `lending`, `time-value-of-money` e `debt-management` (`.claude/skills/`). Taxas oficiais do Banco Central.

## 1. Objetivo

Mostrar à pessoa, com números claros, **quanto ela deve, quanto paga de juros e quanto da renda está comprometido**:

- **Parte A, cartões de crédito:** cadastro, limite total e disponível, faturas (aberta, fechada, paga), compras parceladas, fechamento e vencimento, e histórico.
- **Parte B, empréstimos e financiamentos:** taxa de juros real descoberta a partir do que a pessoa sabe, custo total, saldo devedor, quitação antecipada estimada e comparação com as taxas oficiais do banco e do mercado.
- **Indicador "Comprometimento de renda"** no painel.

Cada parte tem plano, PR e deploy próprios. A Parte A sai primeiro.

## 2. Decisões

| # | Decisão | Alternativas descartadas | Motivo |
|---|---|---|---|
| C1 | **Competência:** uma compra no cartão conta como gasto na data da compra. Na compra parcelada, a parcela k conta na data da compra + (k−1) meses (dia limitado ao fim do mês). | Contar no pagamento da fatura | Escolha do usuário. Mostra quando se gastou, e as categorias não ficam "atrasadas". |
| C2 | **O cartão é um tipo de conta (`credit_card`) no livro-caixa existente. Pagar a fatura é uma transferência** da conta pagadora para o cartão. | Módulo separado; híbrido | Escolha do usuário (abordagem 1). Painel, categorias, filtros e indicadores funcionam sem reescrita, e o pagamento não conta o gasto duas vezes. |
| C3 | **Cada lançamento de cartão grava a sua fatura** (`invoiceMonth`, AAAA-MM do vencimento). A regra: compra até o dia de fechamento entra na fatura que fecha naquele mês; depois, na seguinte. Fechamento no dia 31 em mês curto vira o último dia do mês. | Calcular a fatura na leitura | Mudar o fechamento depois não reescreve o histórico. |
| C4 | **Lançamentos de cartão são sempre "pagos"** (o gasto aconteceu). Quem tem situação é a **fatura**: aberta (antes do fechamento), fechada (fechou e não está quitada), paga (pagamentos ≥ valor) e vencida (passou do vencimento sem quitar). | Status por lançamento | Uma situação só, onde ela existe de verdade. |
| C5 | **Parcelada em N vezes:** N lançamentos ligados por `installmentGroupId`, numerados k/N. A primeira parcela leva os centavos da divisão, e as faturas são consecutivas. | Um lançamento com o total | Cada parcela cai na sua fatura e no seu mês (C1). |
| C6 | **Limite disponível = limite − dívida do cartão**, contando as parcelas futuras, como faz o banco. | Ignorar parcelas futuras | É o que o banco faz. |
| C7 | **Pagamento parcial é permitido.** O restante continua como dívida do cartão. Os juros do rotativo **não** são calculados nesta versão. | Calcular o rotativo | YAGNI. A dívida aparece e o indicador a conta. |
| C8 | **O empréstimo é cadastrado com valor recebido + parcela + nº de parcelas** (+ "já paguei X"). A taxa informada é opcional e serve para conferência: se a diferença passar de 0,1 p.p. ao mês, o app avisa ("pode haver seguro ou tarifa embutida"). | Exigir a taxa; aceitar qualquer combinação | Escolha do usuário. Usa o que a pessoa sabe e revela a taxa. |
| C9 | **Só tabela Price (parcelas fixas) nesta versão.** Um financiamento em SAC pode ser cadastrado, mas a taxa aparece como aproximada, com aviso. | Suportar SAC já | Cobre empréstimo pessoal, consignado e veículo. SAC fica para depois. |
| C10 | **As parcelas do empréstimo são lançamentos pendentes criados no cadastro** (da parcela X+1 à N), ligados por `loanId`, na categoria padrão nova "Empréstimos e financiamentos". | Recorrência sem fim; módulo separado | Prazo finito e conhecido. Aparecem em "A pagar", e pagar atualiza o progresso. |
| C11 | **Quitação antecipada estimada = valor presente das parcelas restantes à taxa real** (CDC art. 52 §2º: redução proporcional dos juros). Sempre rotulada como estimativa. | Não mostrar | Responde "quanto falta de verdade". |
| C12 | **Taxas do Banco Central** (API Olinda `taxaJuros` v2, `TaxasJurosMensalPorMes`): sincronização mensal pela Vercel Cron, guardadas em `bank_rates`. Se a API falhar, ficam os últimos dados, com a data visível. | Busca genérica na web | Fonte oficial, por banco e modalidade, gratuita. |
| C13 | **Comprometimento de renda** = (parcelas de empréstimo do mês + parcelas de compras parceladas no cartão com fatura no mês + faturas vencidas e não quitadas) ÷ média das receitas pagas nos 3 meses completos anteriores. Faixas: ≤ 30% "Na meta", 30–40% "Atenção", > 40% "Alto". | Usar a fatura inteira | Compra à vista é gasto, não dívida. 30% é a referência brasileira; a skill `debt-management` usa 36%. |

## 3. Modelo de dados (Prisma)

- **`AccountType`** ganha `credit_card`.
- **`Account`** ganha colunas opcionais, obrigatórias só quando o tipo é `credit_card` (validado na API):
  - `creditLimit` (BigInt);
  - `closingDay` e `dueDay` (1–31);
  - `paymentAccountId` (a conta pagadora padrão).
  - O saldo inicial do cartão é sempre 0.
- **`Transaction`** ganha:
  - `invoiceMonth` (Date, primeiro dia do mês da fatura; só em lançamentos de cartão e em pagamentos de fatura);
  - `installmentGroupId`, `installmentNumber` e `installmentTotal`;
  - `loanId`.
- **`Loan`** (nova tabela):
  - `id`, `userId`, `name` e `kind` (enum: `personal`, `payroll`, `vehicle`, `mortgage`, `other`);
  - `bankCnpj8` (opcional) e `bankName`;
  - `principal`, `installmentAmount` (BigInt), `installmentsTotal` e `installmentsPaidBefore`;
  - `firstDueDate`, `accountId`, `informedMonthlyRate` (Decimal, opcional) e `createdAt`.
  - Excluir um empréstimo apaga as parcelas pendentes e mantém as pagas, desvinculadas.
- **`BankRate`** (nova tabela):
  - `month`, `modality`, `institution`, `cnpj8`, `monthlyRate`, `annualRate` e `position`;
  - chave única (`month`, `modality`, `cnpj8`).
- **Categoria padrão nova:** "Empréstimos e financiamentos" (despesa). Os perfis existentes ganham a categoria por migração.

## 4. Regras e cálculos (funções puras em `apps/api/src/domain/`, com testes)

- **`invoiceMonthFor(purchaseDate, closingDay, dueDay)`:** a fatura em que uma compra cai (C3). Casos de borda testados:
  - compra no próprio dia do fechamento;
  - fechamento no dia 31 em mês curto;
  - vencimento antes do fechamento no calendário (vence no mês seguinte ao fechamento).
- **`splitInstallments(totalCents, n)`:** a parcela 1 leva o resto (C5).
- **Situação da fatura:** com base em hoje, no fechamento, no vencimento, no valor e nos pagamentos (C4).
- **`impliedMonthlyRate(principal, installment, n)`:**
  - resolve `principal = parcela × (1 − (1+i)^−n) / i` (Newton, com bisseção de reserva, precisão de 1e-10);
  - se `parcela × n ≤ principal`, a taxa é 0 e não há juros;
  - taxa anual = (1+i)^12 − 1.
- **Saldo devedor depois de p parcelas** = parcela × (1 − (1+i)^−(n−p)) / i, que também é a quitação estimada (C11).
  - economia na quitação = parcela × (n−p) − quitação;
  - custo total = parcela × n, e juros = custo total − principal.
- **`debtCommitment(...)`:** o indicador de comprometimento (C13). Sem renda, o resultado é `null`.

## 5. API (`/api/v1`)

- **Cartões** usam `/accounts`, com os campos novos quando o `type` é `credit_card`. A resposta inclui:
  - `limitAvailable`;
  - `openInvoice` (mês e valor);
  - `nextDue` (data e valor).
- **`GET /cards/:id/invoices?from&to`:** as faturas, com valor, pago, situação, fechamento e vencimento.
- **`GET /cards/:id/invoices/:month`:** a fatura com os lançamentos.
- **`POST /transactions`** aceita compra no cartão (`accountId` de um cartão) com `installments` opcional (2–48). A resposta traz as parcelas criadas.
- **`POST /cards/:id/invoices/:month/payments`:** `{ amount, accountId, paidDate }`, que cria a transferência com `invoiceMonth`.
- **Empréstimos:**
  - `GET /loans` e `POST /loans`;
  - `GET /loans/:id`, que traz o resumo calculado e a comparação com o Banco Central;
  - `PATCH /loans/:id` (só nome);
  - `DELETE /loans/:id`.
- **`GET /banks?q=`:** instituições da última sincronização, para o seletor.
- **Correspondência tipo → modalidade do Banco Central:** o primeiro passo do plano da Parte B lê a lista oficial de modalidades da API (`$select=Modalidade`) e fixa, em código e com teste, qual modalidade compara cada `kind`. Na verificação de 2026-11-12, os nomes do financiamento imobiliário vieram como "Financiamento imobiliário com taxas de mercado - Prefixado" e variantes. Nenhum nome é suposto antes dessa leitura.
- **`GET|POST /internal/cron/sync-bank-rates`:** protegido pelo `CRON_SECRET`, roda todo mês.
- **`/dashboard/summary`:**
  - `health` ganha `debtCommitment` (fração ou `null`) e `debtPayments` (centavos);
  - `upcoming` passa a incluir as faturas fechadas e não pagas.
- **Isolamento:** todas as rotas filtram por `userId`. Recurso de outro usuário dá 404.

## 6. Telas

- **Contas:**
  - um formulário para o tipo "Cartão de crédito" (limite, fechamento, vencimento, conta pagadora);
  - o cartão do cartão mostra limite usado e disponível e a fatura aberta.
- **Faturas** (`/cartoes/:id`):
  - a fatura aberta em destaque, as fechadas e o histórico, cada uma com os lançamentos;
  - um botão "Pagar fatura", com valor sugerido igual ao saldo da fatura.
- **Novo lançamento:**
  - escolher um cartão como conta mostra "Parcelar em" (1 a 48x), com uma prévia ("10x de R$ 120,00 · primeira fatura: dez/2026").
- **Empréstimos** (`/emprestimos`):
  - uma lista com progresso;
  - um formulário com seletor de banco e tipo;
  - uma página de detalhe: taxa real (ao mês e ao ano), "pegou R$ X e vai devolver R$ Y; R$ Z são juros", pago, falta, saldo devedor, quitação estimada e um cartão de comparação com o Banco Central (data e fonte).
- **Painel:** o terceiro tile, "Comprometimento de renda", no mesmo padrão dos indicadores atuais (número, situação com ícone e texto, fórmula escrita).
- **Navegação:** o item "Empréstimos" entra no menu.

## 7. Demo

- **Cartão "Cartão principal"** (limite de R$ 8.000, fecha no dia 26, vence no dia 5):
  - 5 faturas pagas, uma fechada e a aberta;
  - uma compra parcelada em 10x em andamento.
- **Financiamento de veículo:** R$ 30.000 recebidos, 48x de R$ 950, 12 pagas, num banco presente em `bank_rates`. Sem dados sincronizados, a demo mostra só o cálculo próprio.

## 8. Erros e casos-limite

- **Cartão:**
  - criar sem limite ou com dia fora de 1–31 dá 422;
  - lançar receita num cartão dá 422 (estornos ficam fora do escopo);
  - pagar mais do que a fatura é permitido, e o excesso reduz a dívida do cartão.
- **Empréstimo:**
  - `installmentsPaidBefore ≥ installmentsTotal` dá 422;
  - parcela ≤ 0 dá 422;
  - se a taxa calculada passar de 30% ao mês, o app avisa que pode haver erro de digitação.
- **Banco Central fora do ar:** a sincronização registra um aviso e mantém os dados anteriores.

## 9. Testes

- **Domínio (unitários):** C3, C5, situação da fatura, taxa implícita (exemplos da skill `time-value-of-money`), saldo devedor, quitação e indicador.
- **API (integração, Postgres real):**
  - fatura e pagamento;
  - limite com parcelas futuras;
  - empréstimo com parcelas geradas;
  - comparação com o Banco Central a partir de dados semeados;
  - isolamento entre usuários;
  - cron com e sem segredo.
- **Cliente do Banco Central:** testado com uma resposta gravada (sem rede no CI).
- **Web:** formulários, prévia de parcelas e tile.
- **E2E:**
  - comprar no cartão, ver a fatura, pagar e ver o saldo;
  - cadastrar um empréstimo e ver a taxa real.

## 10. Fora do escopo

Juros do rotativo; estornos; cartões adicionais; anuidade, pontos e cashback; SAC exato; importação de fatura (OFX/PDF); edição completa de empréstimo (nesta versão: excluir e cadastrar de novo); portabilidade automática.

## 11. Critérios de aceite

1. Uma compra à vista no cartão conta no mês da compra, cai na fatura certa pelo fechamento e não reduz a conta corrente até o pagamento.
2. Uma compra em 10x cria 10 parcelas consecutivas que somam o total exato, cada uma no seu mês e na sua fatura.
3. Pagar a fatura reduz a conta pagadora, não aparece como gasto e marca a fatura como paga. O limite disponível volta.
4. Ao cadastrar R$ 10.000 em 24x de R$ 600, o app mostra a taxa real com 2 casas, o total de R$ 14.400 e juros de R$ 4.400.
5. "Já paguei 12 de 48" gera só as 36 parcelas restantes como pendentes e mostra o saldo devedor e a quitação estimada.
6. Com dados sincronizados, o empréstimo mostra a média do banco e do mercado para a modalidade, com o mês de referência.
7. O tile "Comprometimento de renda" segue C13 e aparece também na demo.
8. Nenhuma rota nova expõe dados de outro usuário (teste de isolamento verde).
9. CI verde (lint, typecheck, unitários, integração e E2E) e as duas partes no ar.
