# Ganho de Capital — Alienação de Imóveis e Outros Bens

Quando há **venda de imóvel, veículo, ações fora da bolsa, ou outro bem** com valor de venda **superior ao custo de aquisição**, ocorre fato gerador de **Imposto sobre Ganho de Capital**. Esse imposto é apurado **fora** do programa do IRPF, em programa específico chamado **GCAP**.

## Quando se aplica

- **Imóveis**: venda de casa, apartamento, terreno, sala comercial, sítio, etc.
- **Veículos**: venda de carro, moto, embarcação, aeronave (acima de R$ 35 mil).
- **Ações fora de bolsa**: venda direta entre pessoas (não via B3).
- **Participações societárias**: venda de quotas de LTDA, ME, EIRELI.
- **Direitos**: cessão de fundo de comércio, pontos comerciais, direitos hereditários.
- **Joias, obras de arte, antiguidades**: venda acima de R$ 35 mil.
- **Moeda estrangeira em espécie**: alienação acima de USD 5.000 (ou equivalente).
- **Criptoativos**: venda mensal acima de R$ 35 mil somando todos os ativos.

> **Operações em bolsa** (B3) **NÃO** são apuradas via GCAP — usam REVAR e DARF 6015 (ver `renda-variavel-revar.md`).

## Programa GCAP

- Programa oficial da RFB, **separado** do programa IRPF.
- Disponível em: https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/programa-ganho-capital
- **Versão GCAP 2026** abrange operações de 01/01/2025 a 31/12/2025.
- Após apurar no GCAP, gera DARF e **importa** os dados para a declaração IRPF (ficha "Ganhos de Capital").
- Não confunda com programa IRPF: GCAP é específico para alienação de bens fora de bolsa.

## Alíquotas progressivas — Ganho de Capital

Aplicam-se sobre o ganho líquido (valor de venda − custo de aquisição − despesas dedutíveis):

| Faixa de ganho de capital | Alíquota |
|---|---|
| Até R$ 5.000.000,00 | **15%** |
| De R$ 5.000.000,01 a R$ 10.000.000,00 | **17,5%** |
| De R$ 10.000.000,01 a R$ 30.000.000,00 | **20%** |
| Acima de R$ 30.000.000,00 | **22,5%** |

**Recolhimento**: DARF código **4600** até o **último dia útil do mês seguinte** ao da operação.

> Atraso no DARF gera multa de mora (0,33% ao dia, máx. 20%) + juros SELIC.

## Isenção — Imóvel residencial único

**Isento** o ganho de capital na venda de imóveis se cumpridos **TODOS**:

1. O imóvel vendido é **residencial** (não comercial, não terreno).
2. O proprietário não realizou outra alienação isenta nos **últimos 5 anos**.
3. O valor da alienação é de **até R$ 440.000,00**.
4. O contribuinte não possuía outro imóvel residencial em seu patrimônio na data da operação (ou, se possuía, está alienando).

> **Limite de uma alienação por 5 anos**: vendeu imóvel residencial isento em 2023? Só pode aplicar a isenção novamente em 2028.

## Isenção — Reinvestimento em outro imóvel residencial (180 dias)

Mesmo SEM atender ao limite de R$ 440 mil, há isenção se:

1. O imóvel vendido é residencial **OU** o produto da venda está sendo usado para adquirir/construir imóvel residencial.
2. O contribuinte aplica **TODO** o produto da venda na compra de **outro imóvel residencial** localizado no Brasil.
3. A nova compra ocorre em até **180 dias** contados da data do contrato de venda.
4. O contribuinte não usou essa isenção nos últimos 5 anos.

**Aplicação parcial**: se aplica apenas parte do produto da venda na nova aquisição, há tributação proporcional sobre o ganho não-reinvestido.

**Imposto de até 5 anos depois**: se vender o imóvel adquirido com a isenção em até 5 anos, deve recolher o IR diferido com correção SELIC.

## Custo de aquisição — Componentes dedutíveis

Para apurar ganho de capital, o **custo de aquisição** inclui:

✅ Valor pago no contrato de compra (escritura pública).
✅ ITBI (Imposto sobre Transmissão de Bens Imóveis).
✅ Despesas com avaliação, levantamento topográfico.
✅ Comissões de corretagem pagas na **compra** (não na venda).
✅ Reformas e benfeitorias (com NF e comprovação).
✅ Juros, taxas e correção monetária do financiamento durante a quitação.
✅ Despesas de inventário/escritura pública.
✅ Para terreno: custo da construção (com NF de cada item: cimento, mão de obra, etc).

## Despesas dedutíveis — Na alienação

Reduzem o valor de venda na apuração:

✅ Comissão da imobiliária (na **venda**).
✅ Taxas e custas para preparação da escritura.
✅ Imposto de Transmissão devido pelo vendedor (raro).
✅ Pintura/reparos para preparar para venda (até 30 dias antes, com NF).

## Fatores de redução para imóveis adquiridos antes de 1989/1996

A RFB aplica **fatores de redução** automáticos no GCAP para imóveis antigos:

- **Imóveis adquiridos antes de 1969**: 100% de redução (totalmente isento).
- **Imóveis adquiridos entre 1969 e 1988**: redução decrescente (5% a 95% do ganho).
- **Imóveis adquiridos entre 1996 e 2025**: redução pelo **Fator de Redução** (FR1, FR2) — calculado automaticamente pelo programa GCAP.

> Esses fatores tornam imóveis antigos com substancial valorização **muito menos tributados** que imóveis recentes.

## Lei 14.973/2024 — Atualização para valor de mercado

Para imóveis declarados **antes de 31/12/2023**, foi aberta janela em 2024 para opcional:
- Atualizar o **valor declarado** ao valor de mercado (com avaliação).
- Pagar **4% sobre a diferença** (alíquota reduzida).
- Janela de opção: 16/09/2024 a **16/12/2024** (já encerrada).

**Se você optou**: a partir do IRPF 2025 o imóvel aparece pelo valor atualizado. Em vendas até 15 anos depois, há **clawback** proporcional (recalcula com regra antiga, paga diferença).

**Se não optou**: o imóvel continua pelo valor histórico de aquisição.

## Como declarar na DAA (após GCAP)

1. Apurar no **GCAP 2026** (programa próprio).
2. Recolher o **DARF 4600** até o último dia útil do mês seguinte.
3. **Importar para o IRPF**: na ficha "Ganhos de Capital", clicar em "Importar do GCAP".
4. Atualizar a ficha "Bens e Direitos": baixar o bem alienado (situação 31/12 = R$ 0 com discriminação "Alienado em DD/MM/2025 conforme GCAP").
5. Registrar entrada de eventual outro bem (dinheiro recebido em conta bancária, ou imóvel novo se foi reinvestimento).

## Casos especiais

### Permuta de imóveis
- **Sem torna** (sem dinheiro): não há ganho de capital. Apenas substitui o bem.
- **Com torna** (recebe dinheiro): apura ganho proporcional sobre o valor da torna.

### Doação ou herança
- **Receber bem por doação/herança**: não tributa. Bem entra no patrimônio pelo **valor declarado pelo doador/de cujus** OU **valor de mercado** (escolha do beneficiário).
- **Doar/transferir bem em vida**: não tributa o doador (mas há ITCMD estadual).

### Imóvel financiado quitado em 2025
- O ato de quitar o financiamento NÃO gera ganho de capital.
- Atualizar o valor declarado para incluir o saldo amortizado em 2025 (juros + principal).

### Venda parcelada
- Apura ganho **integral** no momento da venda (não diluído nas parcelas).
- DARF deve ser pago no mês seguinte à venda.
- Recebimento parcelado vira "Crédito a receber" na ficha "Bens e Direitos".

## Erros frequentes

- ❌ Apurar ganho no programa IRPF (correto: usar GCAP separadamente).
- ❌ Esquecer de pagar DARF 4600 dentro do mês — gera multa + juros.
- ❌ Não atualizar custo de aquisição ao longo dos anos com benfeitorias (perde dedução).
- ❌ Não declarar a venda do imóvel no IRPF (RFB cruza dados de cartórios — malha fina certa).
- ❌ Confundir isenção R$ 440 mil com R$ 35 mil (este último é para outros bens, não imóvel).
- ❌ Tentar aplicar isenção 180 dias com **outro tipo de imóvel** (terreno, comercial). Só vale residencial → residencial.

## Checklist GCAP

- [ ] Identificar TODAS as alienações de bens em 2025 (imóvel, carro acima de R$ 35k, ações fora de bolsa, joias, etc).
- [ ] Reunir contratos, escrituras, NFs e recibos de cada operação.
- [ ] Listar custos: aquisição + benfeitorias + ITBI + juros financiamento + corretagem.
- [ ] Calcular ganho bruto (valor venda − custos).
- [ ] Verificar isenções aplicáveis (R$ 440k, 180 dias, imóvel pré-1969).
- [ ] Apurar no GCAP 2026 e gerar DARF 4600.
- [ ] Pagar DARF até último dia útil do mês seguinte à operação.
- [ ] Importar GCAP → IRPF na ficha "Ganhos de Capital".
- [ ] Baixar bem alienado em "Bens e Direitos" (saldo 31/12 = R$ 0 com discriminação).
- [ ] Lançar dinheiro recebido (conta bancária) ou bem adquirido com o produto da venda.

## Fontes oficiais

- **Programa GCAP**: https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/programa-ganho-capital
- **Lei 7.713/1988** (regula imposto de renda PF — base do ganho de capital).
- **Lei 11.196/2005** (isenção R$ 440 mil + reinvestimento 180 dias).
- **Lei 14.973/2024** (atualização opcional para valor de mercado).
- **Manual Perguntas e Respostas IRPF 2026** — capítulo Ganhos de Capital.
