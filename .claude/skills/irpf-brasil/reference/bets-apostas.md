# Apostas Esportivas e Cassino Online (Bets) — IRPF 2026

## Marco regulatório

**Lei nº 14.790/2023** — regulamentou o mercado de apostas de quota fixa no Brasil. Para o ciclo IRPF 2026, a Receita Federal criou:
- Códigos específicos em "Bens e Direitos".
- Faixa de isenção anual.
- Distinção entre plataformas autorizadas e offshore.

## Os dois domínios fiscais (não confundir!)

A skill deve sempre tratar **separadamente**:

1. **Patrimônio** (saldo na carteira da bet em 31/12/2025) → "Bens e Direitos".
2. **Rendimentos** (prêmios líquidos auferidos durante 2025) → "Rendimentos Sujeitos à Tributação Exclusiva" OU "Rendimentos Tributáveis" (depende da plataforma).

## 1. Declaração patrimonial — Saldos em carteira

### Regra (corrigida — fonte: contabeis.com.br + Receita Federal)
Se o saldo na **carteira virtual da bet** em **31/12/2025 às 23:59** for **superior a R$ 140,00**, é **obrigatório declarar** o bem individualmente.

> **Esclarecimento**: o limite de **R$ 140** é o threshold padrão para declaração de **qualquer** saldo em conta/aplicação financeira (incluindo carteiras de bets). Não confundir com **R$ 800.000** que é o limite **total de bens e direitos** que aciona a obrigatoriedade de entrega da DAA inteira (ver `obrigatoriedade.md`).
>
> **Quando a regra do R$ 140 importa**:
> - Se você está declarando IRPF (já obrigado por outro critério: salário > R$ 35.584, etc), deve declarar **TODA** carteira de bets > R$ 140 individualmente.
> - Se você não está obrigado a declarar (renda baixa), saldos < R$ 140 podem ser omitidos.

### Como declarar
- Ficha: **Bens e Direitos**.
- Grupo: **06 — Depósitos e Aplicações**.
- Código: **02** (campo específico criado em 2026 para apostas).
- Descrição: nome da plataforma + CNPJ.
- Situação em 31/12/2024: saldo no ano anterior (zero se nova).
- Situação em 31/12/2025: saldo na data, conforme extrato/comprovante.

### Distinção crítica de CNPJ
- **Plataforma autorizada (nacional)**: usa CNPJ brasileiro registrado no Ministério da Fazenda.
- **Plataforma offshore**: pode não ter CNPJ — usar identificador da empresa, país de origem, descrição completa.

## 2. Tributação de prêmios

### Tipo de tributação: DEFINITIVA / EXCLUSIVA NA FONTE
Significado prático:
- O imposto recolhido **NÃO** vira crédito para abater outros impostos (como salário).
- **NÃO** será restituído mesmo que o apostador tenha prejuízos massivos.
- Cada prêmio é um evento fiscal autônomo.

### Apuração — POR EVENTO (não anual)

**ATENÇÃO REGULATÓRIA CRÍTICA** (IN RFB nº 2.191/2024):

A apuração do imposto sobre prêmios líquidos é **POR EVENTO** — não consolidada anualmente.

> "A apuração deve ser concretizada, de forma isolada, **para cada aposta após o encerramento de evento real de temática esportiva ou para cada sessão de evento virtual de jogo on-line**." — IN RFB 2.191/2024

**Implicações práticas**:
- ❌ **NÃO existe compensação** de perdas em outros eventos contra ganhos em um evento.
- ❌ **NÃO existe consolidação anual** de "lucro líquido total" de bets.
- ❌ **NÃO se subtrai** sessões perdedoras de sessões ganhadoras para reduzir base.
- ✅ Cada evento/sessão é um fato gerador isolado.

**Exemplo prático**:
- Apostador ganhou R$ 5.000 num jogo de futebol em março/2025.
- Apostador perdeu R$ 4.500 em vários outros eventos durante o ano.
- Para fins de IR: o prêmio líquido tributável é **R$ 5.000** (do evento ganhador), não R$ 500 (saldo).
- Plataforma autorizada já reteve 15% sobre o excedente da isenção desse evento.

### Faixa de isenção
**Por evento ganhador**: o prêmio líquido isento corresponde à **primeira faixa da tabela progressiva mensal vigente** no ano-calendário do evento (R$ 2.259,20/mês em 2025).

> Limite anual de referência: R$ 28.467,20 (12× R$ 2.372,27 — primeira faixa anual). Mas o limite operacional é por evento.

### Alíquota sobre o excedente
**15%** sobre o que exceder a faixa isenta — recolhida automaticamente pela plataforma autorizada via DARF.

Exemplo:
- Prêmios líquidos totais 2025: R$ 50.000.
- Isenção: R$ 28.467,20.
- Tributável: R$ 21.532,80.
- IR devido: 15% × R$ 21.532,80 = R$ 3.229,92.

## Distinção decisiva: Plataforma Nacional vs Offshore

### Plataforma Nacional Autorizada
**Quem são**: empresas com licença do Ministério da Fazenda (lista oficial em https://www.gov.br/fazenda → SPA — Secretaria de Prêmios e Apostas). Exemplos atuais (sujeito a atualização): Bet365, Betano, Sportingbet, F12.bet, Esportes da Sorte, etc — **somente as licenciadas**.

**Responsabilidade fiscal**: a **própria empresa retém** o imposto (15%) sobre o excedente da isenção e repassa à RFB. O apostador **não recolhe DARF**.

**Como declarar**:
- Ficha: **Rendimentos Sujeitos à Tributação Exclusiva/Definitiva**.
- Campo específico: "Prêmios líquidos obtidos em loterias de apostas de quota fixa — Lei 14.790/2023" (novo em 2026).
- Alternativa (se programa não trouxer o campo específico): "12 — Outros".
- CNPJ: da plataforma autorizada.
- Tipo de Beneficiário: Titular ou Dependente.
- Valor: prêmio líquido bruto recebido (antes da retenção).
- IR retido: o que a empresa já reteve.

### Plataforma Offshore (não autorizada / internacional)
**Exemplos**: plataformas sem licença brasileira, sediadas em Curaçao, Malta, Gibraltar, etc.

**Responsabilidade fiscal**: **inverte** para a pessoa física do apostador. O apostador deveria ter:
1. Apurado mês a mês via **Carnê-Leão** (sistema do e-CAC).
2. Recolhido **DARF código 0190** até o último dia útil do mês seguinte.
3. Tabela progressiva mensal aplicada (não a faixa fixa de 15%).

> **A faixa de isenção de R$ 28.467,20 da Lei 14.790/2023 foi desenhada para plataformas autorizadas**. Para offshore, aplica-se a **tabela progressiva mensal de IRPF** sobre os ganhos como rendimento estrangeiro.

**Como declarar (offshore)**:
- Ficha: **Rendimentos Tributáveis Recebidos de Pessoa Física e do Exterior pelo Titular**.
- Discriminação: nome da plataforma, país, valores mensais.
- Carnê-Leão registrado (idealmente já pago durante 2025).

**Se o apostador NÃO recolheu DARF mensal durante 2025** (cenário muito comum):
1. Calcular o devido mês a mês com tabela progressiva.
2. Recolher **DARFs retroativos** (código 0190) com **multa de mora** + **juros SELIC**.
3. Multa de mora: 0,33% por dia até 20% máximo.
4. Juros: SELIC acumulada do mês seguinte ao vencimento até o pagamento.
5. Lançar na declaração com data correta (mês de recebimento) — programa calculará o que falta pagar no ajuste.

> **Alerta crítico**: a Receita Federal tem acordos de troca de informação fiscal com vários países. Plataformas em Curaçao, Malta, Gibraltar, Panamá compartilham dados via OECD. Ocultar é arriscado e a sanção pode ser de **150% do imposto devido + processo criminal por sonegação**.

## ComprovaBet

**Documento oficial** das plataformas autorizadas, equivalente ao informe de rendimentos.

Conteúdo:
- Total de apostas feitas no ano.
- Total de prêmios brutos recebidos.
- Total de apostas perdidas.
- IR retido pela plataforma.
- CNPJ e razão social.

A skill deve **exigir o ComprovaBet** antes de processar qualquer cálculo de bets nacionais. Se o usuário não tem, orientá-lo a:
1. Acessar a área do cliente da plataforma.
2. Procurar seção "Imposto de Renda" ou "Documentos Fiscais".
3. Baixar PDF do ComprovaBet 2025.

Para plataformas offshore, **não existe ComprovaBet**. Usar:
- Histórico de transações da carteira.
- Extratos bancários mostrando depósitos/saques.
- E-mails de confirmação de prêmios.

## Cálculo prático para apostadores frequentes

Cuidado com a **soma mensal vs anual**:

- A isenção de R$ 28.467,20 é **anual**, não mensal.
- O apostador pode ter ganhado R$ 5.000 num mês e perdido R$ 4.000 no outro — só importa o **líquido anual** dos meses de ganho.

Mas atenção: se o apostador joga em **múltiplas plataformas**, deve **somar todas** para verificar a faixa de isenção. Não há isenção por plataforma.

## Erros comuns

- ❌ Não declarar saldo > R$ 800 → omissão patrimonial, malha fina certa.
- ❌ Confundir prêmio bruto com prêmio líquido (líquido é após descontar a aposta).
- ❌ Tentar compensar perdas de cassino com ganhos esportivos — **não há compensação**.
- ❌ Ignorar plataforma offshore achando que "ninguém vai descobrir" — Banco Central reporta movimentações ao fisco.
- ❌ Lançar prêmios de plataforma autorizada como "Rendimentos Tributáveis" (em vez de "Tributação Exclusiva") — gera cobrança em duplicidade.
- ❌ Esquecer de incluir **freebets** e **bônus** convertidos em saldo real — tributáveis se virarem dinheiro.

## Sinalizadores de alerta para a IA

Se o usuário disser:
- "Ganhei muito em 2025 mas não declarei nada" → carregar este arquivo + **malha-fina-esocial.md** para entender riscos.
- "Aposto em [plataforma]" → verificar se está na lista do Ministério da Fazenda. Se não, é offshore.
- "Tenho R$ 1.500 parados na bet" → declarar em Bens (> R$ 800).
- "Joguei muito mas perdi tudo" → não há nada a tributar (não há prêmio líquido), mas se houve **algum** prêmio durante o ano, pode haver retenção registrada que precisa ser declarada.

## Fontes oficiais para consulta

- Lei nº 14.790/2023.
- Instrução Normativa RFB nº 2.312/2026.
- Portaria SPA/MF (lista de plataformas autorizadas — atualizada periodicamente).
- Portal Gov.br → Receita Federal → "Meu IR".
