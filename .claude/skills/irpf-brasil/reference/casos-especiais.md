# Casos Especiais — Espólio, Saída Definitiva, MEI, Residência Fiscal

Cobre situações tributárias específicas que não se encaixam no fluxo padrão de declaração do IRPF.

## 1. Espólio — Falecimento do contribuinte

### Conceitos
- **Espólio**: massa de bens, direitos e obrigações deixada pelo falecido, antes da partilha.
- **Inventariante**: pessoa nomeada para administrar o espólio (geralmente cônjuge, filho, advogado).
- **De cujus**: termo jurídico para o falecido.
- **Partilha**: divisão dos bens entre os herdeiros (judicial ou extrajudicial via cartório).

### Três tipos de declaração

| Tipo | Quando | Programa |
|---|---|---|
| **Inicial** | Ano do falecimento, ANTES da partilha | IRPF normal, marcando "Espólio Inicial" |
| **Intermediária** | Anos entre o falecimento e a partilha (se a partilha demorar) | IRPF, marcando "Espólio Intermediária" |
| **Final** | Ano em que houve **decisão judicial** de partilha OU **escritura pública** de inventário | IRPF, marcando "Espólio Final" — encerra o CPF do falecido |

### Quem declara

O **inventariante** apresenta a declaração em nome do espólio, usando o CPF do falecido (que permanece ativo até a Final).

### Particularidades

**Renda**: o espólio declara rendimentos recebidos pelo falecido **antes** do óbito (no ano do falecimento) e rendimentos do espólio **depois** do óbito (aluguéis, juros de aplicações). Aplica tabela progressiva normal.

**Bens**: declarar todos os bens em 31/12 do ano-base. Na Final, baixar todos os bens transferindo aos herdeiros.

**Imposto a pagar**: deve ser quitado pelo espólio antes da partilha. Se imposto a restituir, vai ao espólio (e depois aos herdeiros via inventário).

**Transferência de bens aos herdeiros**:
- **NÃO há ganho de capital** se transferido pelo valor declarado pelo falecido.
- **Pode haver ganho de capital** se herdeiro optar por valor de mercado (atualizado).
- ITCMD (estadual) é devido pelo herdeiro (varia: 4-8% conforme estado).

### Prazo da Declaração Final

Deve ser entregue **até 30 (trinta) dias** após o trânsito em julgado da decisão judicial OU lavratura da escritura pública de partilha. Atraso gera multa proporcional.

### Erros frequentes em espólio

- ❌ Tratar como declaração comum sem marcar "Espólio".
- ❌ Não atualizar bens incluindo recebimentos pós-óbito (juros, aluguéis).
- ❌ Esquecer de baixar os bens na Final (deixando o CPF com bens "ativos" após morte).
- ❌ Não declarar rendimentos isentos (lucros distribuídos a herdeiro durante intermediária).

---

## 2. Saída Definitiva do País

### Quando aplica

Brasileiro (ou estrangeiro residente fiscal) que se muda **permanentemente** para outro país.

### Documentos a apresentar

1. **Declaração de Saída Definitiva do País (DSDP)**: declaração separada do IRPF normal, com prazo específico.
2. **Comunicação de Saída Definitiva**: aviso à RFB de que está saindo.
3. **DAA do ano da saída**: declaração tradicional cobrindo período até a data da saída.

### Dois prazos críticos

- **Comunicação**: a partir da data de saída até **último dia de fevereiro** do ano-calendário seguinte.
- **DSDP + DAA**: prazo normal do IRPF (mar a mai do ano seguinte). Mas com formato específico.

### Após a saída

- O CPF **permanece ativo** mas com situação "**não-residente fiscal**".
- Rendimentos auferidos no Brasil após a saída são **tributados na fonte** com alíquotas próprias (geralmente 25% sobre renda de trabalho; 15% sobre aluguéis e dividendos).
- **Não há mais obrigatoriedade** de DAA anual (declaração de ajuste).
- A pessoa **não pode** mais ser dependente em IRPF de outro contribuinte residente.

### Bens deixados no Brasil

- Continuam declarados pela última DAA (a do ano da saída).
- Rendimentos sobre bens (aluguéis, juros) são tributados na fonte; não entram em ajuste anual.
- Venda futura de bens gera ganho de capital, **tributado pelo próprio adquirente** quando for não-residente.

### Saída temporária (até 12 meses)

NÃO requer DSDP. A pessoa continua **residente fiscal**, declara IRPF normalmente. Mudança automática para "não-residente" só ocorre após **12 meses consecutivos fora**.

---

## 3. Residência Fiscal — Determinação

### Quem é residente fiscal no Brasil

Conforme RFB, é residente quem:
- Tem residência permanente em território brasileiro;
- Ausentou-se por mais de 12 meses, mas voltou ao Brasil em caráter definitivo;
- É naturalizado ou nasceu no Brasil e nunca apresentou DSDP;
- Estrangeiro com **visto permanente** no Brasil;
- Estrangeiro com **visto temporário** que permanece > 184 dias em 12 meses.

### Quem é NÃO-residente fiscal

- Quem fez DSDP regular.
- Quem está fora do Brasil há mais de 12 meses sem voltar.
- Estrangeiro em estadia inferior a 184 dias.

### Por que importa

| Situação | Tributação |
|---|---|
| Residente fiscal | Tributação universal: rendimentos do Brasil + exterior |
| Não-residente | Apenas rendimentos com fonte no Brasil, geralmente retidos na fonte |
| Dupla residência (Brasil + outro país) | Aplica tratado bilateral (ex: Portugal, EUA, Alemanha) ou regra de desempate (centro de interesses vitais) |

---

## 4. MEI — Microempreendedor Individual

### Duas obrigações distintas

**MEI tem DUAS declarações anuais**:

1. **DASN-SIMEI** (Declaração Anual Simplificada do MEI):
   - **Sempre obrigatória** para todo MEI.
   - Prazo: até **31 de maio** de cada ano.
   - Reporta receita bruta do ano-calendário.
   - Feita no Portal do Empreendedor (https://www.gov.br/empresas-e-negocios/pt-br/empreendedor).

2. **IRPF - DAA**:
   - **Obrigatória apenas** se o MEI pessoa física se enquadrar nos critérios (ver `obrigatoriedade.md`).
   - Reporta rendimentos da pessoa física, incluindo o lucro distribuível do MEI.

### Lucro distribuível (isento) vs lucro tributável

O MEI pode distribuir **parte do lucro como isento** e o restante como tributável. Os percentuais isentos variam por atividade:

| Atividade | % da receita bruta isenta |
|---|---|
| **Comércio** (revenda de mercadorias) | 8% |
| **Indústria** (produção de bens) | 8% |
| **Transporte de cargas** | 8% |
| **Transporte de passageiros** | 16% |
| **Serviços em geral** | 32% |

**Como funciona**:
- Receita bruta MEI 2025: R$ 80.000 (atividade comércio).
- Lucro isento: 8% × 80.000 = **R$ 6.400 isento**.
- Lucro tributável distribuído: tudo que exceder R$ 6.400.

**Onde declarar no IRPF**:
- Lucro isento → ficha "Rendimentos Isentos e Não-Tributáveis", com discriminação.
- Lucro tributável → ficha "Rendimentos Tributáveis Recebidos de PJ" (CNPJ do próprio MEI).
- Receita bruta total → não declarada no IRPF (já reportada via DASN-SIMEI).

### Cuidados

- ❌ **Não distribuir todo o lucro como isento** se ele exceder o percentual permitido — sobra é tributável.
- ❌ **Não confundir receita bruta com lucro distribuível** — o limite isento é sobre receita, não lucro.
- ❌ **MEI sem contabilidade formal**: a regra do percentual aplica diretamente. Com contabilidade formal, pode-se distribuir o lucro contábil real isento (geralmente mais alto).

### MEI — alterações Lei 15.270/2025

A partir de 01/01/2026 (impactando IRPF 2027):
- Lucros distribuídos a sócio MEI/Simples acima de **R$ 50.000/mês** sofrem **retenção 10%** na fonte.
- IRPFM (Imposto Mínimo) também se aplica a sócios MEI com renda total > R$ 600k/ano.

Ver `mudancas-2026-2027.md` para detalhes.

---

## 5. Cônjuges — Declaração Conjunta vs Separada

### Opções

**Conjunta**: um cônjuge declara como **titular** e o outro como **dependente**. Soma rendas e bens. Aplica deduções por dependente (R$ 2.275,08 ao titular). Nenhuma fica obrigatória individualmente.

**Separada**: cada um faz sua DAA independente. Bens podem ser declarados:
- 100% por um deles.
- 50/50 (regime de comunhão parcial — mais comum).
- Conforme regime de bens previsto no casamento.

### Como decidir

**Conjunta vence quando**:
- Apenas um dos cônjuges tem renda significativa.
- Renda total (soma) cabe na faixa intermediária (até alíquota 22,5%).
- Há benefício significativo em educação ou saúde do dependente cônjuge.

**Separada vence quando**:
- Ambos têm renda alta (cada um já bate teto da simplificada R$ 16.754,34).
- Soma das rendas empurra para alíquota 27,5% (em conjunta).
- Um cônjuge tem ganhos de bolsa significativos (declaração separada protege contra cruzamento).

**Regra prática**: simular ambos os cenários no programa do IRPF e escolher o de menor imposto total.

### Alimentos pós-divórcio

- Quem **paga pensão alimentícia judicial** ao ex-cônjuge: dedutível **sem teto** no completo.
- Quem **recebe pensão alimentícia**: rendimento tributável (entra na própria DAA).
- Pensão alimentícia entre filhos só dedutível com **decisão judicial ou escritura pública**.

---

## 6. Pessoa com Deficiência (PCD)

### Status especial como dependente

Filho/enteado/irmão/parente sob curatela é dependente **sem limite de idade** se for **incapacitado física ou mentalmente para o trabalho**.

Comprovação:
- Laudo médico oficial (de hospital público ou perito INSS).
- Sentença judicial de curatela (caso aplicável).
- Manter documentação por 5 anos para eventual fiscalização.

### Isenção de imposto sobre rendimentos

Pessoa **com doença grave** (AIDS, câncer, paralisia, esclerose múltipla, cardiopatia grave, etc — Lei 7.713/88 art. 6º XIV) tem:
- **Aposentadoria/pensão**: isenta do IR (sem limite).
- **Outros rendimentos**: tributados normalmente.
- **Saque do FGTS**: isento.

A isenção é **permanente** após o reconhecimento — não precisa renovar laudo a cada ano (exceto para neoplasia maligna em alguns casos).

### Pensão de PCD

Pensão alimentícia paga a PCD com decisão judicial é dedutível **sem teto**.

---

## 7. Atividade Rural

### Quem declara

Pessoa física com receita bruta em atividade rural superior a **R$ 177.920** em 2025 → obriga DAA com ficha específica.

### Apuração

- **Lucro presumido rural**: receita bruta × 20% (presunção legal).
- **Lucro real**: receita - despesas comprovadas (livro caixa rural).
- A escolha pelo lucro real é vantajosa quando despesas reais > 80% da receita.

### Ficha específica

"Atividade Rural" no programa IRPF:
- Receita por atividade (agricultura, pecuária, piscicultura, apicultura, etc).
- Despesas dedutíveis (sementes, fertilizantes, máquinas, mão de obra rural).
- Investimentos (compra de equipamentos, melhorias).
- Compensação de prejuízos de anos anteriores (sem limite de tempo).

### Imóveis rurais

Têm tratamento próprio, separado de imóveis urbanos:
- ITR (Imposto sobre Propriedade Territorial Rural) — federal, anual.
- DITR (Declaração do ITR) — separada da DAA.
- Renda de aluguel/arrendamento rural → tributada como aluguel comum.

---

## 8. Carnê-Leão — Rendimentos sem retenção

### Quem usa

Pessoas físicas que recebem rendimentos **sem retenção na fonte**, vindos de:
- Outras pessoas físicas (locação de imóvel, prestação de serviços a PF, pensão recebida no exterior antes da Lei 14.754/2023).
- Exterior (dependendo da natureza — ver `renda-variavel-revar.md` e Lei 14.754/2023).
- Profissionais autônomos sem vínculo empregatício recebendo de PF.

### Mecânica mensal

1. Apurar renda do mês.
2. Aplicar tabela progressiva mensal.
3. Recolher **DARF código 0190** até o último dia útil do mês seguinte.
4. Acumular durante o ano e declarar na DAA (ficha "Rendimentos Tributáveis Recebidos de PF").

### Aluguel de imóvel

- Aluguel recebido de PJ → tributado na fonte pela imobiliária; lançar como tributável recebido de PJ.
- Aluguel recebido de PF → **Carnê-Leão** mensal com DARF 0190.

### Recibos eletrônicos

A RFB recomenda que profissionais autônomos emitam recibos eletrônicos via portal do contribuinte para gerar trilha de auditoria.

---

## 9. Doações Recebidas

### Tributação por estado (ITCMD)

Doações **NÃO** são tributadas pelo IRPF do recebedor — mas pelo **ITCMD** estadual:
- Alíquotas variam por estado (4% a 8%).
- Limites de isenção variam (alguns estados isentam até X salários mínimos).
- **Quem paga**: o **donatário** (quem recebe).
- **Prazo**: varia por estado, geralmente 30 dias após a doação.

### Como declarar no IRPF

- Bens recebidos por doação: ficha "Bens e Direitos" (entrada).
- Valor da doação: ficha "Rendimentos Isentos e Não-Tributáveis" → **código 14** (Transferências patrimoniais — meação e doação).
- **Doador**: lança a saída do bem em "Bens e Direitos" e a doação em "Doações efetuadas" (sem benefício fiscal).

### Doações com benefício fiscal (do doador)

Diferente das anteriores, são as feitas a **fundos** com lei de incentivo:
- **FIA** (Fundo da Criança e Adolescente) — federal, estadual, municipal.
- **Fundo do Idoso**.
- **Lei Rouanet** (cultura).
- **Lei do Desporto**.
- **Pronon/Pronas/PCD** (oncologia/PCD).

Doação dedutível **até 6%** do imposto devido (somando todas — exceto Pronon/Pronas que somam 1% adicional cada).

---

## Resumo: quando carregar este arquivo

Carregar `casos-especiais.md` quando o usuário mencionar:
- "espólio", "morreu", "inventário", "partilha", "herdei"
- "saí do Brasil", "morando fora", "expatriação", "saída definitiva"
- "residência fiscal", "estrangeiro morando no Brasil"
- "MEI", "microempreendedor", "DASN-SIMEI", "lucro distribuível"
- "casamento", "cônjuge dependente", "declaração conjunta"
- "deficiência", "PCD", "doença grave", "isento aposentadoria"
- "atividade rural", "agricultor", "pecuarista", "DITR"
- "Carnê-Leão", "aluguel recebido de PF", "autônomo"
- "doação recebida", "ITCMD", "herança"
