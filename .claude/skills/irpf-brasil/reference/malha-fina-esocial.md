# Malha Fina, e-Social e EFD-Reinf — IRPF 2026

## Contexto: a transição que está gerando a crise de 2026

Para o ano-base de 2025, o governo **extinguiu definitivamente a DIRF** (Declaração do Imposto sobre a Renda Retido na Fonte) para fins de IRPF e a substituiu por **dois sistemas mensais e granulares**:

- **e-Social** — eventos trabalhistas, previdenciários e de folha de pagamento.
- **EFD-Reinf** — outras retenções (PJ a PF, prestadores de serviço, condomínios, etc).

A migração foi feita às pressas, departamentos pessoais erraram a parametrização, e o resultado é que **centenas de milhares de contribuintes caíram em malha fina por erro do empregador**, não por erro próprio.

A função primária da skill nesta área é **proteger o contribuinte de assumir como verdade dados errados que vieram do empregador**.

## A regra de ouro (NÃO NEGOCIÁVEL)

Quando houver **divergência entre o informe físico/PDF do empregador e a pré-preenchida**:

> **NUNCA** orientar o usuário a apagar/alterar manualmente os valores da pré-preenchida para igualar ao informe.

Por quê? A pré-preenchida vem da **base oficial do governo** (e-Social/EFD-Reinf). Se o usuário transmite com valores diferentes da base oficial, o cruzamento eletrônico **automaticamente joga em malha fina** por divergência de fonte. Mesmo que o número do usuário esteja "certo" pelo informe, o sistema só vai liberar quando a fonte oficial bater.

## Padrões de erro mais comuns em 2026

### 1. 13º Salário tributado como rendimento comum

**O que aconteceu**: o evento S-1200 do e-Social foi mal classificado pelo RH, levando a que o 13º (que deve ser **tributação exclusiva**, sem entrar na base de cálculo do ajuste anual) entrasse como **rendimento tributável comum**.

**Impacto no usuário**: a base tributável fica inflada em ~1/12 do salário anual, empurrando para alíquota maior (frequentemente para 27,5%).

**Como detectar**:
- Comparar a soma anual do informe (ex: R$ 80.000) com o valor "Rendimentos Tributáveis" da pré-preenchida (ex: R$ 86.500).
- Se a diferença é ~1/13 do total, é provável erro de 13º.

### 2. Regime caixa vs competência

**O que aconteceu**: a Receita usa **regime de caixa** — o salário tributa quando o **dinheiro entra na conta**.

Empresas declararam ao e-Social pelo regime de **competência** — o salário registrado quando **deveria ser pago**.

Salário trabalhado em dezembro/2025 e pago em janeiro/2026:
- Pela RFB (caixa): tributa em **2026** (próxima declaração).
- Pelo erro empresa (competência): tributa em **2025** (declaração atual).

**Impacto**: rendimento extra na declaração atual que ainda nem foi recebido em 2025.

### 3. Plano de saúde duplicado

**O que aconteceu**: o plano de saúde corporativo foi declarado tanto pelo **e-Social** (como subsídio do empregador) quanto pela **DMED** (declaração da operadora). Ambos foram para a pré-preenchida.

**Impacto**: a despesa médica aparece em **dobro**. Quando o cruzamento bate com a operadora, fica metade pendente — bloqueia restituição.

### 4. Auxílios e benefícios isentos como tributáveis

Vale-refeição, vale-alimentação, vale-transporte que **deveriam ser isentos** foram classificados em rubricas tributáveis no e-Social.

### 5. Bônus e PLR

PLR (Participação nos Lucros) tem **tributação exclusiva** com tabela própria. Frequentemente classificada como rendimento comum.

### 6. Pagamento de férias

Adicional de 1/3 sobre férias é **tributável**. Mas o salário de férias propriamente dito também é. Erros de classificação misturam os dois e geram divergência.

## Protocolo de Defesa (passo a passo)

Quando o usuário identificar divergência:

### Etapa 1 — Congelamento
**Não fazer nada na declaração.** Não transmitir, não apagar valores.

A IA orienta o usuário a:
- Salvar a pré-preenchida como rascunho.
- Imprimir/baixar PDF do informe físico do empregador.

### Etapa 2 — Análise documental
Identificar com precisão **qual rubrica** está errada:

```
Comparação a fazer:
| Rubrica           | Informe físico | Pré-preenchida | Divergência |
|-------------------|----------------|----------------|-------------|
| Salário           | R$ 60.000      | R$ 60.000      | OK          |
| 13º               | R$ 5.000       | R$ 0           | -5.000      |
| Tributável total  | R$ 60.000      | R$ 65.000      | +5.000 ❌   |
| 13º como exclusivo| R$ 5.000       | R$ 0           | -5.000 ❌   |
```

→ Diagnóstico: o 13º foi para "Tributável" em vez de "Tributação Exclusiva".

### Etapa 3 — Intervenção corporativa
Usuário aciona o **Departamento Pessoal** (DP) ou **Recursos Humanos** (RH) da empresa, **POR ESCRITO** (e-mail, ticket interno):

> "Identifiquei uma divergência na minha pré-preenchida do IRPF 2026 em relação ao informe de rendimentos físico que recebi. A diferença está em [explicar]. Solicito a retificação dos eventos do e-Social/EFD-Reinf — provavelmente o evento **S-5002** (DCTFWeb / Demonstrativo Mensal IRRF) precisa ser ajustado para corrigir a rubrica [X]. Por favor, providenciem a retificação até [prazo razoável, ex: 15 dias úteis] para que eu possa transmitir a declaração corretamente."

Recomendar guardar todo o histórico de comunicação.

### Etapa 4 — Aguardar reprocessamento
Após a empresa retificar:
- Sistema da Receita Federal **reprocessa automaticamente** a base.
- Em até **7 dias úteis** os dados pré-preenchidos atualizam.
- Usuário deve **reabrir** a pré-preenchida no e-CAC para validar.

### Etapa 5 — Transmitir
Após confirmação de que a pré-preenchida bate com o informe corrigido, transmitir normalmente.

## Cenário alternativo: empresa não retifica

Se a empresa **se recusa** ou demora muito:

**Opção A — Aguardar**: o pior cenário é cair em malha. Quando isso acontecer, o contribuinte pode protocolar **defesa administrativa** no e-CAC com:
- Cópia do informe físico.
- Comunicação por escrito com a empresa.
- Eventualmente, ata notarial confirmando a recusa.

**Opção B — Transmitir e ajustar via retificadora**: transmitir com os valores da pré-preenchida (mesmo errados) e, quando a empresa corrigir, enviar **declaração retificadora** sem multa.

**Opção C — Levar à Justiça do Trabalho**: em casos extremos, o erro do RH em rubricas afeta também o INSS e FGTS — pode haver justa causa para reclamação trabalhista. Recomendar advogado.

## Quando a divergência É culpa do contribuinte

Nem toda divergência é culpa do empregador. A IA deve verificar primeiro:

- Recebeu rendimentos de **mais de uma fonte** em 2025 e está olhando só um informe?
- Recebeu **pró-labore** ou **distribuição de lucros** de empresa própria que não vem na pré-preenchida automaticamente?
- Recebeu **prêmios** em concursos, sorteios?
- Recebeu **rendimentos de aplicações** que vão para "Tributação Exclusiva", não para tributável?

## Sinalizadores que a Receita usa para malha fina

A skill deve estar atenta a estes triggers:

| Sinalizador | Como evitar |
|---|---|
| Rendimento tributável menor que o e-Social | Não suprimir valores — corrigir na origem |
| Despesas médicas > 30% da renda anual | Toda despesa tem que ter NF/recibo com CPF do prestador |
| Educação > R$ 3.561,50 por pessoa | Não tentar burlar o teto |
| Saldo de bens incompatível com renda declarada | Lançar isentos (FGTS, indenizações, doações, herança) |
| Soma de saídas > soma de entradas (no extrato) | Justificar com isentos ou empréstimo |
| Dependente com renda alta + dedução completa | Rodar simulação A/B antes |
| Imóvel comprado em 2025 não declarado | Lançar com valor da escritura |
| Veículo declarado por valor inferior à FIPE no ano-base | Manter pelo valor de aquisição (não FIPE) |

## Códigos de receita para retificações e DARFs

Se houver imposto a pagar em atraso após retificação:

| Código DARF | Aplicação |
|---|---|
| **0211** | IRPF — Quota única ou demais quotas (declaração) |
| **0190** | Carnê-Leão |
| **6015** | Ganhos líquidos em renda variável |
| **8053** | Ganho de capital — alienação de bens |
| **4600** | Multa por atraso de declaração |

Acessar **https://sicalc.receita.fazenda.gov.br** para gerar DARF com vencimento + multa + juros calculados.

## Verificação de status na malha

Após transmissão, monitorar em **e-CAC → Meu Imposto de Renda → Extrato da Declaração**:

- **Em processamento**: aguardar.
- **Processada**: tudo certo, aguardando lote.
- **Em fila de restituição**: aprovada, vai entrar em algum lote.
- **Com pendências (Malha Fina)**: precisa ação. Verificar **mensagem específica**:
  - "Divergência em rendimentos tributáveis" → comparar com informes (mais comum em 2026).
  - "Divergência em pagamentos efetuados" → revisar despesas médicas e educação.
  - "Não localizado pagamento de IRRF" → empresa não recolheu o imposto retido.

Para **autorregularizar** sem precisar passar por fiscal: em "Pendências da Malha", há opção de **enviar declaração retificadora**.

## Defesa em malha fina (procedimento)

Se cair em malha:

1. **NÃO desespere** — 80% dos casos resolvem com retificadora simples.
2. Acessar e-CAC → Extrato da Declaração → ver mensagem específica da pendência.
3. Reunir **comprovantes** (informes, NFs, recibos, extratos).
4. Se foi erro do empregador → exigir retificação como descrito acima e aguardar.
5. Se foi erro próprio → **enviar declaração retificadora** com correção.
6. Se discordar da Receita → **agendar atendimento presencial** ou **abrir processo eletrônico** no e-CAC apresentando documentos.

Prazo de prescrição da fiscalização: **5 anos** após a transmissão. Manter documentação por todo o período.

## Checklist defensivo pré-transmissão

- [ ] Imprimi/salvei TODOS os informes de rendimento em PDF?
- [ ] Comparei o total de rendimentos tributáveis (informe vs pré-preenchida)?
- [ ] Comparei IRRF (informe vs pré-preenchida)?
- [ ] 13º está em "Tributação Exclusiva", não em "Tributáveis"?
- [ ] Plano de saúde não está duplicado (e-Social + DMED)?
- [ ] Despesas médicas com NF/recibo e CPF do prestador?
- [ ] Reembolsos de plano de saúde foram subtraídos das despesas?
- [ ] Salário de dezembro pago em janeiro NÃO está em 2025?
- [ ] Bens novos (imóvel, carro) lançados com valor de escritura/NF?
- [ ] Saldo de aplicações em 31/12/2025 bate com extrato bancário?
- [ ] Salvei o **recibo da declaração** após transmissão?
