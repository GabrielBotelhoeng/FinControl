# Renda Fixa — IRPF 2026

## Princípio fundamental

**Tributação exclusiva na fonte**: o imposto já foi recolhido pela instituição financeira no resgate/vencimento. Não entra na base do ajuste anual nem afeta restituição.

Função da skill: **garantir que os saldos estão declarados em Bens e Direitos** com os mesmos valores dos informes bancários — para evitar malha fina por incompatibilidade patrimonial.

## Tabela regressiva (CDB, Tesouro Direto, fundos, debêntures comuns)

Aplica-se ao **prazo da aplicação** (do investimento até o resgate/vencimento):

| Prazo | Alíquota |
|---|---|
| Até 180 dias | 22,5% |
| 181 a 360 dias | 20,0% |
| 361 a 720 dias | 17,5% |
| Acima de 720 dias | 15,0% |

A alíquota é aplicada **sobre o rendimento** (juros gerados), não sobre o saldo total.

## Tabela específica de fundos

### Fundos de curto prazo (carteira média ≤ 365 dias)
| Prazo | Alíquota |
|---|---|
| Até 180 dias | 22,5% |
| Acima de 180 dias | 20,0% |

### Fundos de longo prazo (carteira média > 365 dias)
Aplica a tabela regressiva geral (15% a 22,5% conforme prazo).

### Come-cotas
**Antecipação semestral** de IR em fundos abertos:
- Maio e Novembro de cada ano.
- Alíquota: **15%** (longo prazo) ou **20%** (curto prazo).
- Já vem deduzido do saldo do informe.

## Aplicações isentas de IR

Estas aparecem em **"Rendimentos Isentos e Não Tributáveis"**:

| Ativo | Por quê |
|---|---|
| **LCI** (Letra de Crédito Imobiliário) | Lei 11.033/2004 |
| **LCA** (Letra de Crédito do Agronegócio) | Lei 11.311/2006 |
| **CRI** (Certificado de Recebíveis Imobiliários) | Isento para PF |
| **CRA** (Certificado de Recebíveis do Agronegócio) | Isento para PF |
| **Debêntures incentivadas** (Lei 12.431/2011) | Infraestrutura |
| **Poupança** | Lei 8.981/1995 |
| **LIG** (Letra Imobiliária Garantida) | Lei 13.097/2015 |

> **Atenção**: o saldo dessas aplicações ainda vai em **Bens e Direitos**. A isenção é apenas dos rendimentos, não da obrigação de declarar o patrimônio.

## Códigos de Bens e Direitos (renda fixa)

| Código | Ativo |
|---|---|
| **41** | Caderneta de poupança |
| **45** | Aplicação de renda fixa (CDB, RDB) |
| **46** | Ouro, ativo financeiro |
| **49** | Outras aplicações financeiras |
| **70** | Fundo de Curto Prazo |
| **71** | Fundo de Longo Prazo e Fundo de Investimento em Direitos Creditórios (FIDC) |
| **72** | Fundo Multimercado |
| **77** | Fundo de Renda Fixa |
| **04** | Tesouro Direto (LFT, LTN, NTN-B, etc) — código geral 04 (Letras do Tesouro Nacional) ou 99 com descrição |

> Convenção 2026: Tesouro Direto entra como código **04** quando LTN/LFT, ou **99** "Outros bens" com descrição completa para NTN-B principal.

## Onde declarar — fluxograma

### Para cada aplicação financeira:

```
Tem rendimento durante 2025?
├── SIM → "Rendimentos Sujeitos à Tributação Exclusiva/Definitiva"
│         (campo correspondente: Aplicações Financeiras)
│         Valor = rendimento líquido do ano (do informe)
│
└── NÃO → não lançar aqui

Tem saldo em 31/12/2025?
├── SIM → "Bens e Direitos"
│         Código: ver tabela acima
│         Discriminação: nome da instituição + CNPJ + número/identificador
│         Situação em 31/12/2024: saldo do ano anterior
│         Situação em 31/12/2025: saldo no informe
│
└── NÃO (resgatado integralmente) → não lançar (mas declarar movimentação se relevante)
```

### Para aplicações isentas:
- **Rendimento** → ficha "Rendimentos Isentos e Não Tributáveis".
- **Saldo** → ficha "Bens e Direitos".

## Validação obrigatória

Cruzar **informe de rendimentos do banco/corretora** com a declaração:

1. **Saldo em 31/12/2024** (linha do informe) = **Situação em 31/12/2024** na declaração.
2. **Saldo em 31/12/2025** = **Situação em 31/12/2025** na declaração.
3. **Rendimentos** lançados separadamente: tributáveis em "Tributação Exclusiva", isentos em "Isentos".
4. **CNPJ** da instituição financeira deve estar no informe e na declaração — **mesmo CNPJ**.

A divergência mais comum: o usuário lança o saldo arredondado (R$ 50.000), mas o informe diz R$ 49.873,42. **Sempre usar o valor exato do informe**.

## Erros frequentes

- ❌ Lançar saldo de poupança como tributável — é isento.
- ❌ Esquecer LCI/LCA — saldo vai em Bens, rendimento em Isentos.
- ❌ Lançar fundo DI sem detalhar o **CNPJ do fundo** (não da gestora).
- ❌ Confundir **come-cotas** (já recolhido) com IR a pagar — não tem nada a recolher.
- ❌ Lançar Tesouro Direto pelo valor de mercado em 31/12. **Correto**: pelo **valor de aquisição** + custo (ou pelo valor reportado pelo BMF/B3 no informe — atualmente alinhado).
- ❌ Esquecer **aplicações abertas e zeradas** dentro do ano — se durante 2025 fez aplicação e resgatou no mesmo ano, declarar o **rendimento** mesmo que o saldo final seja zero.

## Imposto retroativo / IOF / DARF

Renda fixa **não gera DARF mensal pelo investidor**. O imposto é retido na fonte pelo banco/custodiante.

**Exceção**: se o usuário fez aplicação direta com pessoa física (ex: empréstimo a outro indivíduo com juros), aí o rendimento é **renda de pessoa física** — vai em "Rendimentos Tributáveis Recebidos de PF" e exige Carnê-Leão mensal com DARF código 0190.

## Checklist final renda fixa

- [ ] Coletei todos os informes bancários (banco principal + corretoras + outros)?
- [ ] Cada saldo em 31/12/2025 está em "Bens e Direitos" com CNPJ correto?
- [ ] Rendimentos tributáveis lançados em "Tributação Exclusiva"?
- [ ] LCI/LCA/poupança/debênture incentivada em "Isentos"?
- [ ] Come-cotas considerado? (não recolher novamente)
- [ ] Códigos de Bens corretos por tipo de ativo?
