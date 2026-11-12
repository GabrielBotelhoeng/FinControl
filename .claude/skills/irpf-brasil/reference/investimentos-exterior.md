# Investimentos no Exterior — Lei 14.754/2023 Detalhada

A **Lei nº 14.754/2023** (regulamentada pela **IN RFB nº 2.180/2024**), vigente desde **01/01/2024**, reformou completamente a tributação de investimentos no exterior por residentes fiscais brasileiros. Substituiu o regime fragmentado anterior (Carnê-Leão mensal por tipo de rendimento) por um modelo **unificado de tributação anual a 15%** com **transparência fiscal** para estruturas controladas.

> Esta referência aprofunda o que está mencionado em `renda-variavel-revar.md` e cobre temas avançados como **regime antidiferimento**, **trusts** e **variação cambial**.

## 1. Aplicações Financeiras no Exterior — Regime Geral

### Conceito
Inclui depósitos, aplicações em renda fixa, ações, ETFs, fundos, créditos, derivativos, criptoativos custodiados em corretora estrangeira, e qualquer investimento financeiro em entidade não-residente.

### Tributação
- **Alíquota única**: **15%** sobre **rendimentos auferidos** (dividendos, juros, ganhos de capital).
- **Apuração**: **anual**, no DAA (Declaração de Ajuste Anual).
- **Não há mais Carnê-Leão mensal** para esses rendimentos.
- **Não há mais isenção** de R$ 35.000 mensais em vendas (que existia antes).

### Conversão cambial
- **Saldos em 31/12**: cotação **PTAX de venda do último dia útil** do ano.
- **Operações ao longo do ano**: cotação PTAX de venda da **data de cada operação** (compra ou venda).
- **Distribuições recebidas**: PTAX de venda da **data da distribuição**.

### Onde declarar no IRPF 2026
- Ficha "**Rendimentos Tributáveis Recebidos do Exterior**" → seção **"Aplicações Financeiras no Exterior — Lei 14.754/2023"** (campo específico criado em 2024).
- Saldos em 31/12 → "**Bens e Direitos**" com indicador IN_EXTERIOR=1.
- Programa calcula automaticamente os 15% no DAA e gera DARF.

### Compensação de prejuízos
- **Permitida** apenas dentro do mesmo bloco "aplicações financeiras no exterior".
- **NÃO compensa** com renda variável doméstica (B3) nem com outras categorias.
- Prejuízo carrega indefinidamente, declaração ano a ano.

---

## 2. Regime Antidiferimento — Entidades Controladas no Exterior

> **Este é o ponto mais sofisticado e perigoso da Lei 14.754/2023.** O contribuinte que tem PJ no exterior (offshore) precisa entender que a tributação **não depende mais de receber dividendos**.

### Quando aplica

Pessoa física residente fiscal no Brasil que detenha **entidade controlada** (offshore) no exterior, e a entidade se enquadre em **qualquer** dos seguintes:

1. **Localizada em paraíso fiscal** (lista atualizada pela RFB — atualmente IN RFB nº 1.037/2010, atualizações).
2. **Sob regime fiscal privilegiado** (IN RFB 1.037/2010).
3. **Renda passiva ≥ 40% da receita total** (renda passiva = juros, dividendos, royalties, aluguéis, ganhos de capital, aplicações financeiras).

> "Entidade controlada" = aquela em que o contribuinte detém, direta ou indiretamente, **mais de 50%** dos direitos de voto, do capital ou dos lucros.

### Regra antidiferimento

Se a entidade se enquadra em qualquer critério acima:
- O **lucro contábil anual** apurado pela offshore é tributado **automaticamente em 31/12** de cada ano.
- **Independente** de ter havido distribuição/dividendo ao sócio brasileiro.
- **Independente** do dinheiro permanecer no exterior ou ser repatriado.
- **Alíquota fixa: 15%** sobre o lucro líquido contábil.

### Como apurar

1. **Balanço contábil anual** da entidade controlada elaborado conforme:
   - **IFRS** (International Financial Reporting Standards), OU
   - Padrão contábil brasileiro (BR GAAP / Lei 6.404/76).
2. Calcular **lucro líquido** após impostos pagos no país de domicílio da offshore.
3. Converter para BRL pela **PTAX de venda de 31/12**.
4. Aplicar 15% sobre essa base.
5. Declarar no IRPF brasileiro como rendimento tributável "**Lucros de Entidade Controlada no Exterior**" (campo específico).

### Distribuição posterior

Quando a offshore **efetivamente distribuir** dividendos ao sócio brasileiro **anos depois**:
- A distribuição é **isenta** até o limite do lucro já tributado pela regra antidiferimento.
- Excedente (lucro acumulado pré-2024 ou novo lucro não tributado) — tributado conforme regras vigentes.
- **Manter histórico contábil** ano a ano da tributação automática (controle do "saldo já tributado").

### Riscos de descumprimento

- A RFB recebe relatórios de bancos e jurisdições estrangeiras via **CRS (Common Reporting Standard)** automaticamente.
- Brasil tem acordo de troca automática de informações fiscais com 100+ países.
- Sonegação é detectada por cruzamento internacional.
- Multas: **150% do imposto omitido** + processo criminal por sonegação fiscal.

### Casos NÃO sujeitos ao antidiferimento

- Offshore sem renda passiva ≥ 40% (ex: empresa operacional real exportadora).
- Offshore em país com tratamento fiscal não-privilegiado.
- Participação ≤ 50% (sem controle).
- Para esses casos, regime padrão = tributa apenas no momento da efetiva distribuição.

---

## 3. Trusts no Exterior — Transparência Fiscal

> A Lei 14.754/2023 **eliminou a função de blindagem patrimonial** dos trusts estrangeiros para fins fiscais brasileiros. Trusts agora são "transparentes" — seus bens são tributados como se pertencessem diretamente ao Settlor.

### Personagens

- **Settlor** (instituidor): pessoa que cria o trust e transfere bens para ele.
- **Trustee** (administrador): entidade ou pessoa que administra o trust legalmente.
- **Beneficiário(s)**: quem(quem) recebe distribuições do trust.

### Regra de transparência fiscal

Durante a vida do **Settlor** (e enquanto ele for residente fiscal no Brasil):
- Os **bens subjacentes** ao trust (ações, imóveis no exterior, fundos, depósitos, etc) são considerados de **propriedade direta do Settlor** para fins de IRPF.
- O Settlor declara cada ativo individualmente em "**Bens e Direitos**" (não declara "trust X" como bloco único).
- Rendimentos das aplicações são tributados como **dele** a 15% no DAA (regra geral Lei 14.754).

### Após falecimento ou entrega de controle

Se o Settlor faleceu OU houve transferência efetiva de controle aos beneficiários:
- A obrigação de transparência migra para os **beneficiários**.
- Cada beneficiário declara sua parcela proporcional dos bens subjacentes.
- Distribuições efetivas são tratadas como:
  - **Doação** (se em vida do beneficiário) → ITCMD estadual + isento de IR.
  - **Herança** (causa mortis) → ITCMD estadual + isento de IR (mas registra entrada do bem no patrimônio).

### Como declarar

1. **Não criar** uma única entrada "Trust XYZ" como bem genérico.
2. **Discriminar TODOS os bens subjacentes** individualmente:
   - Ações de empresa A: ticker, qtd, custo médio, país, custódia.
   - Imóvel em Miami: endereço, custo aquisição, conversão BRL.
   - Aplicações financeiras: cada conta/fundo com CNPJ ou identificador.
3. Rendimentos auferidos pelo trust em 2025 → declarar como rendimentos do Settlor (ou beneficiário, se aplicável) em "Aplicações Financeiras no Exterior — Lei 14.754".

### Migração de declarações antigas

Se você declarou trust em IRPF anterior como bloco único (regra antiga, pré-2024):
- IRPF 2026 exige **fragmentação completa** dos bens subjacentes.
- Realocar valor histórico do "trust" entre os bens individuais.
- Manter documentação do Trust Deed (contrato) para eventual auditoria.

---

## 4. Variação Cambial — Isenções Específicas

A Lei 14.754/2023 manteve **regras de isenção** para casos pessoais de baixo volume, evitando tributar variação cambial trivial.

### A. Variação cambial sobre depósitos remunerados no exterior
- **Regra geral**: tributa rendimentos a 15% (Lei 14.754).
- A variação cambial **integra a base** quando há rendimento.

### B. Variação cambial sobre depósitos NÃO-remunerados (conta corrente sem juros)
- **ISENTA** de IR — não há fato gerador.
- Mesmo que o saldo "valorize" em BRL pela alta do dólar, sem rendimento (juros), não há tributação.
- Apenas **declarar saldo em 31/12** em "Bens e Direitos" → conversão pela PTAX.

### C. Variação cambial sobre moeda estrangeira em espécie (cédulas)
- **ISENTA** se a soma das alienações no ano-calendário **NÃO superar US$ 5.000** (ou equivalente).
- Ex: Voltou de viagem, sobraram US$ 800. Vendeu na casa de câmbio em 2025: **isento**.
- Acima de US$ 5.000 anuais em vendas: tributação a 15% sobre o ganho (diferença entre valor de venda e valor de aquisição).

### D. Aplicação financeira em moeda estrangeira (CDB-USD, fundos cambiais)
- Investida **dentro do Brasil** (instituição brasileira): segue regras nacionais (renda fixa).
- Investida **fora do Brasil**: regime Lei 14.754 (15% no DAA).

---

## 5. Imposto Pago no Exterior — Crédito

Se o contribuinte pagou imposto no país onde a renda foi gerada (ex: withholding tax de 30% sobre dividendos de ações americanas):

### Convenção bilateral (tratado para evitar bitributação)
Brasil tem tratados com vários países (Argentina, Áustria, Bélgica, Chile, China, Coreia do Sul, Dinamarca, Equador, Espanha, Filipinas, Finlândia, França, Hungria, Índia, Israel, Itália, Japão, Luxemburgo, México, Noruega, Holanda, Portugal, Tchéquia, Eslováquia, Suécia, Trinidad/Tobago, Turquia, Ucrânia, Venezuela).
- Crédito: imposto pago no exterior **abatido** do imposto devido no Brasil até o limite do imposto brasileiro sobre aquela renda.

### Sem tratado
- Reciprocidade: alguns países (incluindo EUA) reconhecem reciprocidade de fato.
- Crédito permitido até o limite do imposto brasileiro.

### Onde declarar
- Ficha "**Imposto Pago no Exterior**" no programa IRPF.
- Discriminar país, valor pago em moeda original, conversão BRL pela PTAX, comprovante (recibo do fisco estrangeiro).
- O programa abate automaticamente do imposto devido na DAA.

---

## 6. Erros frequentes em investimentos no exterior

- ❌ **Continuar declarando offshore como "ações de empresa estrangeira"** sem aplicar regime antidiferimento se aplicável.
- ❌ **Esquecer Carnê-Leão de meses anteriores a 2024** — em 2024+, é apuração anual única.
- ❌ **Não declarar rendimentos retidos** no balanço da offshore controlada (achando que sem distribuição não tributa).
- ❌ **Lançar trust como bloco único** em vez de individualizar bens subjacentes.
- ❌ **Compensar prejuízos do exterior contra ganhos da B3** — não permitido.
- ❌ **Ignorar PTAX de 31/12** (usar média ou cotação do "dia que se lembrou").
- ❌ **Não solicitar comprovante de imposto pago no exterior** — perde o crédito tributário.
- ❌ **Vender > US$ 5.000 em moeda física** sem declarar ganho de capital.

---

## 7. Documentação obrigatória — manter por 5 anos

- Extratos mensais de todas as contas no exterior.
- Notas de corretagem de cada operação (compra/venda).
- Comprovantes de dividendos recebidos (1099-DIV USA, equivalentes em outros países).
- Comprovantes de impostos retidos no exterior (1042-S USA, etc).
- Para offshore controlada: **balanço contábil anual completo** + DRE + auditado se possível.
- Para trust: contrato (Trust Deed), declarações do Trustee, lista de bens subjacentes ano a ano.

---

## 8. Quando carregar este arquivo

Carregar `investimentos-exterior.md` quando o usuário mencionar:
- "investimento no exterior", "stocks americanas", "exterior offshore"
- "Lei 14.754", "regime antidiferimento", "entidade controlada"
- "trust", "Settlor", "Trustee", "fundo offshore"
- "paraíso fiscal", "regime fiscal privilegiado", "renda passiva"
- "PTAX", "conversão cambial 31/12"
- "imposto pago no exterior", "1099", "1042-S", "withholding tax"
- "variação cambial", "moeda estrangeira em espécie", "USD 5.000"
- "CRS", "common reporting standard", "troca de informações fiscais"

## Fontes oficiais

- **Lei nº 14.754/2023** (sancionada 12/12/2023): https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14754.htm
- **IN RFB nº 2.180/2024** (regulamenta Lei 14.754).
- **IN RFB nº 1.037/2010** (lista de paraísos fiscais e regimes privilegiados — atualizações periódicas).
- **Gov.br — Tributação Offshore**: https://www.gov.br/fazenda/pt-br/acesso-a-informacao/perguntas-frequentes/tributacao-offshore
- **Receita Federal — Manual IRPF 2026** capítulo Rendimentos do Exterior.
