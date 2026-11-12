# Renda Variável e REVAR — IRPF 2026

## O que é o REVAR

**Calculadora de Renda Variável** da Receita Federal — sistema integrado entre B3, corretoras e RFB que apura automaticamente lucros, prejuízos e impostos de operações em bolsa.

Para 2026 está **integrado obrigatoriamente** ao programa do IRPF. O usuário ainda precisa autorizar o compartilhamento, mas uma vez autorizado, os dados fluem para a pré-preenchida.

## Quem precisa se preocupar

Qualquer pessoa que em 2025:
- Operou ações, ETFs, BDRs, FIIs.
- Operou opções, mercado futuro, mercado a termo.
- Fez **day trade** de qualquer valor.
- Vendeu mais de **R$ 40.000** somando o ano (volume, não lucro).
- Teve ganho líquido > **R$ 20.000** em qualquer mês com operações comuns.

## Ativação do REVAR (passo a passo)

1. Usuário acessa **Área do Investidor** na B3 (https://www.investidor.b3.com.br) com seu CPF.
2. Faz login (geralmente Gov.br).
3. Em "Autorizações" → habilitar **compartilhamento com a Receita Federal**.
4. Acessa o **e-CAC** da Receita.
5. Em "Meu Imposto de Renda" → "Calculadora de Renda Variável (ReVar)" → autorizar coleta dos dados.
6. Após 24-48h, o sistema agrega os dados.
7. Ao iniciar a pré-preenchida, os dados de bolsa virão pré-importados.

## Alíquotas

| Operação | Alíquota |
|---|---|
| **Operações comuns** (swing trade) em ações | 15% sobre ganho líquido |
| **Day trade** (compra e venda no mesmo dia) | 20% sobre ganho líquido |
| **FIIs** (fundos imobiliários) | 20% sobre ganho de capital na venda |
| **ETFs de ações** | 15% sobre ganho líquido |
| **ETFs de renda fixa** | Tabela regressiva (ver `renda-fixa.md`) |
| **Opções, futuros, termo** | 15% comum, 20% day trade |

## Isenção do limite mensal

**Operações comuns em ações**: se a soma das **vendas no mês** for ≤ **R$ 20.000** e for swing trade (não day trade), o **lucro é isento**.

Atenção:
- O limite é por **soma de vendas** (volume), não por lucro.
- Vendeu R$ 25.000 em ações comuns no mês? Mesmo com lucro de R$ 100, paga 15% sobre ele.
- A isenção é mensal — se em janeiro vendeu R$ 15k e em fevereiro R$ 10k, **ambos meses isentos**.
- **Não vale para FIIs, day trade, opções**.

## Apuração (mês a mês, não anual)

A renda variável é apurada **mensalmente**. Para cada mês:

1. Somar lucros e prejuízos do mês.
2. Compensar com prejuízos acumulados de meses anteriores (mesma natureza: comum com comum, day trade com day trade).
3. Se sobrar lucro líquido tributável → recolher **DARF** até o último dia útil do mês seguinte.
4. Códigos DARF:
   - **6015** — Ganhos líquidos em renda variável (PF).

## Auditoria sistêmica (papel da skill)

Mesmo com REVAR, **NÃO confiar cegamente**. A skill deve cruzar:

1. **Notas de corretagem** (PDFs mensais da corretora) vs dados do REVAR.
2. **Saldo de prejuízos acumulados** — se em 2024 declarou R$ 5.000 de prejuízo a compensar, ele deve aparecer disponível em 2025.
3. **Eventos corporativos**:
   - **Splits** (desdobramentos): aumentam a quantidade de ações, reduzem o preço médio. O REVAR deve refletir.
   - **Inplits** (grupamentos): reduzem a quantidade, aumentam o preço médio.
   - **Bonificações**: ações novas a custo zero — afetam o preço médio.
   - **Spin-offs**: nova empresa derivada — divisão do custo entre as empresas resultantes.
4. **Subscrições**: exercício de direitos — entram na carteira a custo declarado.
5. **JCP e dividendos**: dividendos isentos vão na ficha "Rendimentos Isentos"; JCP (Juros sobre Capital Próprio) tributados a 15% na fonte vão em "Tributação Exclusiva".

## Compensação de prejuízos

Prejuízos podem ser compensados **indefinidamente no tempo** (sem prazo de prescrição), mas:
- Prejuízo de **operação comum** só compensa lucro de operação comum.
- Prejuízo de **day trade** só compensa lucro de day trade.
- **Não há compensação cruzada** entre os dois.

Exemplo:
- 2024: R$ 10.000 de prejuízo em day trade.
- 2025 jan: R$ 4.000 de lucro em day trade → compensa, paga zero.
- 2025 jan: R$ 4.000 de lucro em swing trade → **NÃO compensa**, paga 15% normalmente.
- 2025 fev: R$ 5.000 de lucro em day trade → compensa os R$ 6.000 que sobraram → paga zero.
- 2025 mar: R$ 2.000 de lucro em day trade → compensa o restante R$ 1.000 → paga 20% sobre R$ 1.000.

## Onde declarar

| Ficha | Conteúdo |
|---|---|
| **Renda Variável → Operações Comuns/Day Trade** | Lucros e prejuízos mensais |
| **Renda Variável → Operações FII** | Apuração de FIIs |
| **Bens e Direitos** | Saldo de ações em 31/12/2025 (custo médio) |
| **Rendimentos Isentos e Não Tributáveis** | Dividendos recebidos, lucros isentos de venda < R$ 20k |
| **Rendimentos Sujeitos à Tributação Exclusiva/Definitiva** | JCP, IRRF de day trade |

## Códigos de Bens e Direitos para ações

| Código | Ativo |
|---|---|
| **31** | Ações (geral, em bolsa) |
| **47** | Mercados futuros, de opções e a termo |
| **49** | Outras participações societárias |
| **73** | Fundo de Investimento Imobiliário (FII) |
| **74** | Fundo de Investimento em Ações |
| **79** | Outros fundos (exceto imobiliário) |

## Erros frequentes (alertar)

- ❌ Declarar saldo de ações pelo valor de mercado em 31/12/2025. **Errado**: é pelo **custo médio de aquisição**.
- ❌ Esquecer de lançar JCP recebido — vem do banco da corretora, é tributação exclusiva.
- ❌ Não somar custos de corretagem e emolumentos no preço médio (pode aumentar o preço médio e reduzir lucro tributável).
- ❌ Confundir **bonificação de ações** (entra a custo zero ou ao valor especificado pela empresa) com **dividendos**.
- ❌ Lançar prejuízo de day trade compensando lucro de swing trade.
- ❌ Operações em **bolsa internacional** (NYSE, Nasdaq) — NÃO entram no REVAR. Devem ser apuradas via Carnê-Leão e declaradas em "Rendimentos Tributáveis Recebidos do Exterior" + "Bens e Direitos no Exterior" (código 31, país).

## Criptomoedas (Bitcoin, ETH, etc)

Não é renda variável tradicional, mas ainda é tributado:
- **Isenção**: vendas mensais até **R$ 35.000** somando todas as criptos.
- Acima disso: 15% sobre ganho de capital, com alíquotas progressivas a partir de R$ 5 milhões.
- Apuração via **GCAP** (programa de Ganho de Capital), não pelo programa do IRPF nativamente.
- Saldo em 31/12/2025: declarar em Bens e Direitos código **08** (criptoativos), grupo 99.

## Ferramenta auxiliar: `irpf-investidor`

Para calcular preço médio com custos (emolumentos + taxa de liquidação) a partir do export `InfoCEI.xls` da B3:

```bash
pip install irpf-investidor
irpf-investidor   # roda na pasta com o InfoCEI.xls
```

Suporta ações, FIIs e ETFs. **Não suporta** day trade. Use como **segunda fonte** para cruzar com o REVAR. Ver detalhes em `reference/integracoes-externas.md`.

## Checklist final renda variável

- [ ] REVAR autorizado e dados importados?
- [ ] Notas de corretagem batem com REVAR?
- [ ] Eventos corporativos (split, bonificação) refletidos?
- [ ] Prejuízos de anos anteriores aparecem para compensação?
- [ ] DARFs mensais foram pagos durante 2025? (se não, há débito a regularizar)
- [ ] Dividendos isentos lançados em "Rendimentos Isentos"?
- [ ] JCP lançado em "Tributação Exclusiva"?
- [ ] Saldo em 31/12/2025 lançado pelo custo médio em "Bens e Direitos"?
- [ ] Operações em bolsa internacional declaradas separadamente?
