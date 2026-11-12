# Skills de finanças aplicadas ao FinControl

_Atualizado em 2026-11-12._

As 25 skills abaixo estão em `.claude/skills/` (escopo do projeto). Elas foram escolhidas entre 696 de 18 repositórios públicos. Cada pasta guarda `ORIGEM.txt` (repositório de origem) e `LICENSE.origem` (MIT ou Apache-2.0).

## Critérios da escolha

- **Entram:** finanças pessoais, investimentos para pessoa física, regras do Brasil (IR, INSS, CDI, LGPD) e o que conversa com os sub-projetos do roadmap.
- **Ficam de fora:** trading, opções, cripto/DeFi, banco de investimento e compliance regulatório dos EUA (SEC, FINRA). Nada disso se aplica a um app de finanças pessoais no Brasil.
- **Segurança:**
  - Antes de instalar, todas as 696 skills passaram por uma varredura que procurou: instruções escondidas para a IA, `curl | sh`, leitura de credenciais, blobs base64, hooks e settings que executariam comandos sozinhos.
  - Nenhum alerta real nas escolhidas.
  - Só as pastas das skills foram copiadas. Instaladores (`install.sh`), hooks e `settings.json` dos repositórios ficaram de fora.
- **Adaptação ao Brasil:** muitas skills usam produtos dos EUA (401k, IRA, 529, T-bills). Os conceitos e as fórmulas valem. Os produtos se traduzem assim: previdência PGBL/VGBL, Tesouro Selic/IPCA+, CDB com liquidez diária, LCI/LCA e poupança.

## Scripts das skills: só referência

Algumas skills trazem scripts Python. Na primeira revisão, o CodeRabbit apontou erros de cálculo neles:

| Script | Problema |
|---|---|
| `calculadora-cdi/scripts/cdi.py` | A série 4389 do BCB já é a taxa **anual**, mas o script a trata como diária e anualiza de novo. O rendimento sai errado. |
| `debt-management/scripts/debt_management.py` | Dívidas com o mesmo nome se misturam. Ao atingir o limite de meses, o script informa a dívida como quitada. |
| `emergency-fund/scripts/emergency_fund.py` | O resgate pode gerar um cronograma infinito quando o rendimento mensal cobre a retirada. Ao atingir o limite, informa a meta como alcançada. |
| `asset-allocation`, `diversification` | O otimizador fica instável com matrizes de covariância mal escaladas ou singulares. |

Também há dois ajustes de texto: a pontuação de risco do `crm-client-lifecycle` não é normalizada para 0–100, e o `debt-management` trata o ponto de equilíbrio do refinanciamento como se bastasse para provar economia.

**Regra:** o FinControl não executa esses scripts. As skills orientam conceitos e fórmulas. Todo cálculo que entrar no app é implementado no nosso código, com testes próprios e fontes oficiais (ex.: CDI pela API SGS do Banco Central).

## Onde cada skill entra

### 1. Já dá para aproveitar com os dados de hoje

O app já guarda a natureza do lançamento (fixa ou variável), as categorias, o tipo de conta (corrente, poupança, carteira, investimento) e 6 meses de histórico. Os indicadores abaixo podem ser calculados **sem nenhum dado novo**:

| Skill | Indicador no painel | Como calcular com os dados atuais |
|---|---|---|
| `emergency-fund` | **Meses de reserva** | Saldo das contas corrente, poupança e carteira dividido pela média mensal das despesas essenciais (Moradia, Alimentação, Transporte, Saúde, Educação e Contas) nos últimos 3 a 6 meses. Meta: 3 a 6 meses; 6 a 12 para renda variável (quem tem receita em "Freelance"). |
| `liquidity-management` | **Índice de liquidez** e **previsão de caixa de 12 meses** | Ativos líquidos ÷ despesa mensal (meta ≥ 3 a 6). As recorrências já materializadas permitem projetar receitas menos despesas mês a mês e apontar os meses de déficit. |
| `savings-goals` | **Taxa de poupança do mês** | (receitas − despesas) ÷ receitas. Referência da skill: mínimo de 15%. |
| `finance-psychology` | **Plano de 4 baldes** em vez de "orçamento" | Custos fixos (natureza fixa) 50 a 60%, investimentos 10% ou mais, poupança 5 a 10%, gasto livre 20 a 35%. A skill recomenda evitar a palavra "orçamento", que passa sensação de escassez, e tratar o gasto livre como algo planejado, sem culpa. |
| `return-calculations` | **Variação real** dos saldos | CAGR do saldo total. Comparar com o IPCA quando houver índice. |

Encaixe no roadmap: sub-projeto 5 (dashboard completo).

**Entregue em 2026-11-12:** taxa de poupança e meses de reserva no painel (`domain/health.ts`; campo `health` do `/dashboard/summary`).
- A reserva usa o **gasto total médio** (abordagem conservadora, "manter o padrão de vida"), e não só as categorias essenciais. Os nomes de categoria podem ser alterados pelo usuário, então só a soma total é confiável hoje. Uma marcação de "essencial" fica como melhoria futura.
- Contas de investimento ficam fora do saldo líquido.

### 2. Sub-projeto 2: cartões de crédito

| Skill | Uso |
|---|---|
| `lending` | Amortização, custo efetivo e comparação de parcelamento com à vista. No Brasil: juros do rotativo, parcelamento da fatura e "parcelado sem juros" com preço à vista menor. |
| `time-value-of-money` | VP/VF, parcela (PMT) e tabela de amortização (Price e SAC) para simular parcelamentos. |

### 3. Sub-projeto 3: dívidas

| Skill | Uso |
|---|---|
| `debt-management` | **Avalanche** (maior juro primeiro, o que menos custa) **vs bola de neve** (menor saldo primeiro, o que tem maior adesão). Mostrar as duas linhas do tempo lado a lado. **Comprometimento de renda** (parcelas ÷ renda), com alerta acima de ~30%. Análise de portabilidade e refinanciamento (ponto de equilíbrio). |
| `lending` / `time-value-of-money` | Simulação de quitação antecipada e de troca de dívida cara por barata. |

### 4. Sub-projeto 4: planejamento e metas

| Skill | Uso |
|---|---|
| `savings-goals` | Aporte mensal necessário para uma meta, com correção pela inflação (IPCA). Ordem de prioridade adaptada ao Brasil: reserva de emergência → quitar dívida cara (rotativo, cheque especial) → previdência/aposentadoria → demais metas (casa, viagem, estudo). |
| `emergency-fund` | Meta de reserva sugerida automaticamente (seção 1) e montada em camadas: conta corrente (1 mês), CDB de liquidez diária ou Tesouro Selic (2 a 3 meses), resto com liquidez de poucos dias. |
| `asset-allocation`, `diversification`, `rebalancing`, `investment-policy` | Para quando houver contas de investimento detalhadas: alocação por meta e prazo, e alerta de rebalanceamento por faixa (ex.: ±5 p.p.). |
| `retirement-decumulation`, `previdencia-inss` | Meta de aposentadoria, regra dos 4% com ressalvas e regras do INSS para estimar o benefício. |
| `insurance-planning` | Checklist de proteção (vida, saúde, invalidez) para incluir no planejamento. |
| `fixed-income-sovereign` | Conceitos de duration e curva de juros. No Brasil, para Tesouro Prefixado, IPCA+ e Selic. |
| `calculadora-cdi` | Simulação de rendimento de renda fixa em % do CDI. **Ajuste necessário:** o script da skill busca o CDI num site de terceiros; no app a fonte deve ser a API oficial do Banco Central (SGS). |

### 5. Sub-projeto 5: relatórios e exportação

| Skill | Uso |
|---|---|
| `return-calculations`, `performance-metrics` | Retorno ponderado pelo tempo e pelo dinheiro, CAGR e, para investimentos, métricas ajustadas ao risco. |
| `client-reporting-delivery` | Estrutura do relatório mensal ou anual em PDF: resumo, evolução, detalhamento e notas. |
| `tax-efficiency`, `irpf-brasil` | Relatório anual que ajuda a declarar o IRPF: rendimentos por categoria, saldos em 31/12 de cada conta ("Bens e Direitos") e renda fixa. |

### 6. Sub-projeto 6: notificações

| Skill | Uso |
|---|---|
| `next-best-action` | Motor de "próxima melhor ação": regras priorizadas que geram avisos úteis, como "você tem 2 contas vencidas", "sua reserva caiu abaixo de 3 meses", "gastos com Lazer 40% acima da média" ou "sobrou R$ X este mês: quer mandar para a meta Y?". A skill traz a estrutura: gatilhos por evento, pontuação de prioridade (mostrar só as poucas ações mais valiosas) e medição da taxa de aceitação de cada sugestão. |
| `crm-client-lifecycle` | Escrita para assessorias de investimento. A parte útil aqui é a **segmentação por engajamento** (muito, pouco ou nada engajado) e a identificação de **risco de abandono**, que servem para decidir quando e como notificar. |

### 7. Sub-projeto 7: assistente com IA

| Skill | Uso |
|---|---|
| `personal-finance-coach`, `finance-psychology` | Tom e método do assistente: começar pelos objetivos (visão antes da tática), focar nas grandes alavancas, reconhecer vieses e julgar as decisões pelo processo, não pelo resultado, o que reduz a vergonha depois de perdas. |
| `irpf-brasil`, `previdencia-inss`, `calculadora-cdi` | Respostas sobre o Brasil, sempre com o aviso de que é orientação educativa e não substitui contador ou assessor. |

### 8. Aplicado agora: LGPD (`lgpd-br`)

A política em `/privacidade` foi comparada com o checklist da skill. Já está atendido: política pública com link no app, canal de contato, exclusão de conta dentro do app e direitos do art. 18.

| Lacuna | Situação |
|---|---|
| Base legal **por finalidade** | **Resolvido em 2026-11-12.** A política agora traz a execução do serviço (art. 7º, V) para conta e finanças, e o legítimo interesse (art. 7º, IX) para os registros de segurança e o limite de requisições por IP. |
| **Termos de uso** e **idade mínima** | **Resolvido em 2026-11-12.** A página `/termos` exige 18 anos ou mais (decisão do dono, após a pesquisa sobre o ECA Digital). A tela de entrada avisa e liga para termos e privacidade. |
| Transferência internacional (Vercel) | **Parcial.** A API foi fixada em São Paulo (`regions: ["gru1"]`; antes rodava em `iad1`, nos EUA). A política descreve o que ainda pode sair do Brasil (CDN e registros da Vercel, login do Google). O DPA da Vercel (2023) cita as cláusulas da UE, sem as cláusulas-padrão da ANPD. `[advogado]` |
| Registro de operações (art. 37) e plano de incidente | Documentos internos ainda não escritos. A skill tem modelos (versão simplificada para pequeno porte). |

## Próximos passos sugeridos

1. Terminar as lacunas de LGPD: termos de uso depois da decisão sobre idade mínima, mecanismo de transferência internacional, registro de operações e plano de incidente.
2. Abrir as stories dos indicadores da seção 1 (meses de reserva, taxa de poupança, previsão de caixa). Eles aproveitam dados que já existem e dão o maior ganho imediato ao usuário.
3. Nas specs dos sub-projetos 2 a 7, citar as skills desta página como referência de domínio.
