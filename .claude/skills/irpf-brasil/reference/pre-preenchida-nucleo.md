# Declaração Pré-Preenchida e Núcleo Familiar — IRPF 2026

## Por que é o caminho recomendado

Para 2026, a RFB projeta que **60% das declarações** sejam transmitidas via pré-preenchida. Vantagens:

- **Prioridade na restituição**: combinada com PIX-CPF, pula para o 2º nível de prioridade (após idosos, doentes graves e professores).
- **Menor risco de malha fina**: dados já vêm cruzados com fontes oficiais.
- **Menos digitação**: maioria dos campos vem preenchida.

A regra de ouro: **importar primeiro, auditar depois — nunca construir do zero**.

## Pré-requisitos de acesso

1. Conta **Gov.br** nível **Prata ou Ouro** (Bronze não dá acesso).
2. Para Prata: validação biométrica facial via Gov.br + selfie (app) OU bancos credenciados.
3. Para Ouro: validação biométrica + foto do documento via app Gov.br OU certificado digital.
4. **Certificado digital e-CPF (A1 ou A3)** é alternativa que dá acesso direto.

Se o usuário ainda não tem nível Prata/Ouro, oriente:
- Baixar app Gov.br → fazer reconhecimento facial OU
- Validar via internet banking (BB, Caixa, Santander, Bradesco, Itaú, etc) OU
- Comparecer presencialmente a um cartório credenciado.

## O que vem pré-preenchido

A base é alimentada por múltiplas fontes:

| Origem | Dado importado |
|---|---|
| **e-Social** | Salários, 13º, férias, IRRF, INSS, plano de saúde subsidiado |
| **EFD-Reinf** | Outros rendimentos, retenções de PJ a PF |
| **Declarações de Aluguéis** | Aluguéis recebidos via imobiliárias |
| **Cartórios** | Aquisição/alienação de imóveis (ITBI), inventários |
| **Construtoras** | Compras de imóveis na planta |
| **DARF Carnê-Leão** | Pagamentos feitos durante o ano |
| **REVAR (B3)** | Operações em bolsa, FII, day trade — se autorizado |
| **DIMOB** | Aluguéis de imóveis administrados por imobiliárias |
| **DMED** | Pagamentos a planos de saúde, médicos, hospitais |
| **e-Financeira** | Saldos bancários, aplicações financeiras, movimentações |
| **DBF** | Doações declaradas |
| **DIRPF anteriores** | Dependentes, bens, prejuízos a compensar |

## Núcleo Familiar — A grande novidade de 2026

**Conceito**: Quando o titular adiciona um dependente, o sistema **importa automaticamente** todos os eventos fiscais associados ao CPF do dependente — não só dados de anos anteriores, mas também os do ano-calendário 2025.

### Como funciona na prática

1. Titular abre a pré-preenchida.
2. Sistema sugere dependentes recorrentes (que estavam em IRPF 2025/ano-base 2024).
3. Ao confirmar inclusão de um dependente, o sistema puxa para a declaração do titular:
   - Salários do dependente (CTPS, jovem aprendiz, estágio).
   - IRRF retido em pagamentos do dependente.
   - Despesas médicas do dependente (DMED).
   - Movimentações bancárias do dependente acima do limite.
   - Bens em nome do dependente.

### A armadilha

**Incluir um dependente nem sempre vale a pena**. Se o dependente teve renda própria significativa em 2025, ela é **somada à base do titular** e pode:
- Empurrar o titular para alíquota marginal mais alta (ex: de 22,5% para 27,5%).
- Anular o ganho de R$ 2.275,08 (dedução por dependente) e R$ 3.561,50 (educação).
- Aumentar o imposto total pago pelo núcleo.

### Algoritmo de decisão

Sempre rodar **3 cenários** quando o dependente tem renda própria:

```
Cenário A: Titular declara sozinho + dependente declara separadamente (se obrigado)
Cenário B: Titular declara incluindo o dependente (Núcleo Familiar)
Cenário C: Quem tem renda maior declara o outro como dependente

→ Escolher o cenário com MENOR imposto total combinado.
```

### Exemplo prático

- Titular: salário R$ 120.000/ano, alíquota marginal 27,5%.
- Filho 22 anos, universitário, estagiário: ganhou R$ 18.000 em 2025.

**Cenário A (separado):**
- Titular paga IR sobre R$ 120.000 (sem dedução de dependente).
- Filho não é obrigado a declarar (renda < R$ 35.584).
- IR titular: ~R$ 22.247
- IR filho: R$ 0
- **Total: R$ 22.247**

**Cenário B (Núcleo Familiar):**
- Base titular: R$ 120.000 + R$ 18.000 = R$ 138.000.
- Deduções extras: R$ 2.275,08 (dependente) + R$ 3.561,50 (educação) = R$ 5.836,58.
- Base após deduções extras: R$ 132.163,42.
- Imposto adicional sobre R$ 12.163,42 a 27,5% = R$ 3.345.
- IR titular: ~R$ 25.592 (mais que A).
- **Total: R$ 25.592**

→ Cenário A ganha por R$ 3.345.

A IA deve sempre fazer essa conta antes de aceitar incluir dependente com renda.

## Alertas Inteligentes do Sistema

A RFB configurou alertas em tempo real para 2026. A skill deve estar atenta a estes padrões e antecipar:

- **Despesa de dependente sem renda compatível**: ex: lançar R$ 50.000 de plano de saúde para filho que não trabalha.
- **Bens em nome de dependente sem origem declarada**: ex: carro de R$ 80.000 em nome de menor sem declaração de doação.
- **Soma de despesas médicas > 30% da renda**: alto risco de fictícias.
- **Educação acima do teto** (lançar R$ 5.000 quando o teto é R$ 3.561,50): rejeitado automaticamente.
- **Rendimento isento incompatível com bens**: ex: declarar isento R$ 10.000 mas comprar carro de R$ 100.000.

Se o usuário relatar um destes alertas, oriente a **não suprimir** — investigar a origem da divergência.

## Validação manual obrigatória após importar

Mesmo com pré-preenchida, audite com o usuário:

1. **Bens e Direitos**: ver se todos os imóveis, veículos e contas bancárias estão listados. Saldos em 31/12/2025 batem com extrato?
2. **Rendimentos Tributáveis**: somar todos os informes de rendimento físicos e comparar com o total da pré-preenchida.
3. **Rendimentos Isentos**: FGTS, indenizações trabalhistas, lucros de PJ, herança, bolsas de estudo — todos lançados?
4. **Aplicações financeiras**: cada CDB, Tesouro, fundo, ação — saldo correto?
5. **Pagamentos efetuados**: pensão alimentícia, despesas médicas, planos — lançados na ficha "Pagamentos Efetuados"?
6. **Dependentes**: cadastros corretos? CPF batendo? Datas de nascimento corretas (afetam regra de idade)?

## Fluxo recomendado

```
1. Acessar e-CAC com Gov.br Prata/Ouro
2. Iniciar Declaração → "Iniciar com pré-preenchida"
3. Conferir todos os dados importados (não suprimir nada sem investigar)
4. Adicionar manualmente o que faltou (especialmente bens fora do sistema, doações recebidas)
5. Rodar simulação completa vs simplificada
6. Configurar conta para restituição (preferir PIX-CPF)
7. Verificar pendências antes de transmitir
8. Transmitir e GUARDAR o recibo
```

Recibo da declaração é documento obrigatório por **5 anos** após a transmissão (prazo decadencial de fiscalização da RFB).
