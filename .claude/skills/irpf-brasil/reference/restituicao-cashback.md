# Restituição e Cashback IRPF — Ciclo 2026

## Cronograma de lotes

Para 2026, a Receita Federal **comprimiu** o cronograma de 5-6 meses (histórico) para apenas **4 lotes**, devolvendo o capital mais rapidamente à economia.

| Lote | Data de pagamento |
|---|---|
| **1º Lote** | 29/05/2026 |
| **2º Lote** | 30/06/2026 |
| **3º Lote** | 31/07/2026 |
| **4º Lote** | 28/08/2026 |

**Estimativa oficial**: 80% das restituições serão pagas até o 2º lote (junho).

## Ordem de prioridade legal

Pagamento dentro de cada lote segue rigorosamente esta ordem:

1. **Idosos com 80 anos ou mais** (em qualquer mês de 2025).
2. **Idosos com 60 anos ou mais** (mas menores de 80).
3. **Portadores de doença grave** (lei 7.713/88: AIDS, Alzheimer, cardiopatia grave, cegueira, hepatopatia grave, hanseníase, nefropatia grave, neoplasia maligna, paralisia, Parkinson, esclerose múltipla, espondiloartrose, tuberculose ativa, fibrose cística, contaminação por radiação, osteíte deformante).
4. **Portadores de deficiência física, mental ou intelectual grave**.
5. **Professores cuja renda predominante seja oriunda do magistério**.
6. **Quem usou pré-preenchida + indicou conta com PIX-CPF como recebimento**. ← novidade que prioriza modernização.
7. **Demais contribuintes**, em ordem cronológica de transmissão.

> Quem se encaixa em mais de uma prioridade pega a **mais alta**.

## Configuração de recebimento — IMPORTANTE

### PIX vinculado ao CPF (RECOMENDADO)
- A **chave PIX deve ser exclusivamente o CPF** do declarante (não telefone, não e-mail, não chave aleatória).
- Se você não tem CPF cadastrado como chave PIX em nenhum banco, ative em qualquer banco antes de transmitir.
- Validação: a Receita Federal valida a chave **no momento exato** da emissão do lote. Se não for válida ou estiver desativada → contribuinte fica fora do lote até regularizar.

### Conta bancária (Agência + Conta)
- Aceito, mas **PERDE** a prioridade adicional do PIX.
- Conta deve ser **de titularidade do declarante** (não conta de cônjuge, parente, etc).
- Conta-corrente, conta-poupança e conta-pagamento são aceitas.
- Bancos cooperativos (Sicoob, Sicredi) e digitais (Nubank, Inter, etc) são aceitos desde que tenham agência e conta válidas.

### Recomendação da skill
Se o usuário ainda não tem PIX-CPF: orientar a cadastrar **antes** de transmitir. Isso pode adiantar 1-2 lotes na restituição.

## O programa "Cashback IRPF" — novidade 2026

### Conceito
Em 2025, milhões de pessoas **abaixo do limite de obrigatoriedade** (R$ 35.584,00) tiveram **IR retido na fonte** em pagamentos pontuais:
- Férias monetizadas (vale-férias).
- Horas extras altas em algum mês.
- Gratificações (PLR, bônus).
- Plantões médicos extras.
- Rescisões trabalhistas.

Historicamente, esses valores ficavam **retidos pela União** indefinidamente — o trabalhador precisaria fazer declaração voluntária para recuperar. Como a maioria não sabia disso ou não fazia, o dinheiro virava receita do governo.

**Novidade 2026**: a Receita Federal usa os dados do e-Social para identificar **automaticamente** esses casos e **devolver o IR retido** via PIX, **sem necessidade do contribuinte declarar**.

### Quem tem direito ao Cashback IRPF

Os 3 critérios cumulativos:

1. **Não é obrigado a declarar IRPF 2026** (renda total < R$ 35.584,00 e demais critérios também não acionam).
2. **Teve IR Retido na Fonte (IRRF)** em algum pagamento durante 2025.
3. **CPF está regularizado** com chave PIX-CPF ativa.

### Cronograma do Cashback

**Data prevista**: **15/07/2026** — pagamento único, **separado** dos 4 lotes ordinários.

### Como verificar se tem direito

A skill deve orientar:
1. Acessar o **e-CAC** (https://cav.receita.fazenda.gov.br) com Gov.br.
2. Em **Meu Imposto de Renda → Visualizar Restituição**, verificar se há valor sinalizado no contexto Cashback.
3. Se sim e for pequeno (< R$ 1.000 tipicamente), o sistema gera o crédito automático.
4. Confirmar que a chave PIX-CPF está ativa.

### Atenção: o Cashback não é "perdão fiscal"

A IA deve **alertar claramente**:

- Se o contribuinte **omitiu rendimentos** que o tornariam obrigado a declarar (ex: aluguéis recebidos por fora, ganho em bolsa, herança), o Cashback **não substitui a declaração**.
- A Receita pode pagar o Cashback e **mesmo assim** abrir auditoria depois.
- Se o sistema identificar que o contribuinte **deveria ter declarado** mas não declarou, o direito ao Cashback desaparece.

### Vantagem da declaração antecipada vs Cashback

Mesmo quem teria direito ao Cashback automático pode **antecipar** o recebimento:

| Estratégia | Recebimento estimado |
|---|---|
| Aguardar Cashback automático | 15/07/2026 |
| Transmitir declaração simples nos primeiros dias (final mar/início abril) | 29/05/2026 (1º lote) |
| Transmitir nas últimas semanas | 28/08/2026 (4º lote) |

**Recomendação**: para quem é elegível ao Cashback, transmitir uma declaração simples **logo no início do prazo** entrega a restituição até **2 meses antes**.

## Consulta do status da restituição

### Onde consultar
- **App Receita Federal** (Android/iOS) — autenticação Gov.br.
- **Portal e-CAC** — Meu Imposto de Renda → Consultar Restituição.

### Status possíveis

| Status | Significado |
|---|---|
| **Em processamento** | Declaração recebida, ainda em análise inicial |
| **Processada** | Análise OK, aguardando entrar em lote |
| **Em fila de restituição** | Aprovada, será paga em algum lote (próximo ou futuro) |
| **Pagamento efetuado** | PIX/transferência realizada |
| **Restituição com pendência (Malha)** | Caiu em malha fina — ver `malha-fina-esocial.md` |
| **Resgate disponível em banco** | Restituição não foi paga via PIX/conta — disponível em qualquer agência do BB para retirada presencial |

### Restituição não paga
Se por qualquer motivo a restituição não foi creditada (chave PIX inválida, conta encerrada):
- Fica **disponível para resgate por 1 ano** no Banco do Brasil.
- Após 1 ano sem resgate, retorna ao Tesouro e o contribuinte precisa **abrir solicitação manual** no e-CAC para reagendar.

## Imposto a pagar (saldo devedor)

Se a declaração resultar em **imposto a pagar** (em vez de restituir):

### Opções de pagamento

1. **Quota única**: pagamento integral até **30/05/2026** (próximo dia útil após o fim do prazo).
2. **Parcelamento**: até **8 quotas mensais**, mínimo R$ 50/quota.
   - 1ª quota até 30/05/2026.
   - Quotas posteriores: último dia útil de cada mês.
   - Quotas a partir da 2ª levam **juros SELIC** acumulada.

### Débito automático
- Pode ser configurado na transmissão.
- A 1ª quota no débito automático só funciona se o usuário transmitir até **10/05/2026**.
- A partir da 2ª, débito automático funciona para qualquer transmissão dentro do prazo.

### Geração de DARF
- Se não usar débito automático, gerar DARF manualmente.
- Código: **0211** (IRPF — Quota única ou Demais quotas).
- Pagamento em qualquer banco, internet banking, ou via PIX (DARF emitido com QR Code).

## Doação direta na declaração (incentivos fiscais)

No modelo **completo**, é possível **destinar parte do imposto** para fundos com benefício fiscal:

| Fundo | Limite |
|---|---|
| Fundo da Criança e Adolescente (FIA municipal/estadual/federal) | 6% do imposto devido |
| Fundo Nacional do Idoso | 6% do imposto devido (somando com FIA, máx 6%) |
| Lei Rouanet (Cultura) | 6% do imposto devido |
| Lei do Desporto | 6% do imposto devido |
| Pronon (Oncologia) e Pronas/PCD (Pessoas com deficiência) | 1% do imposto devido cada |

> Atenção: doações pelo programa do IRPF têm prazo até **30/05/2026** para pagamento via DARF específico. Doações feitas durante 2025 já foram declaradas.

## Erros que atrasam restituição (mesmo quando aprovada)

- Chave PIX-CPF não ativa no momento do lote → fica fora do lote, espera o próximo.
- Mudança de banco recente sem atualizar dados → mesmo problema.
- Conta bancária encerrada → restituição vai para "resgate em banco" no BB.
- CPF em situação irregular ("Pendente de regularização" ou "Suspenso") → bloqueia tudo. Regularizar em https://servicos.receita.fazenda.gov.br/Servicos/CPF.

## Checklist final pré-transmissão para acelerar restituição

- [ ] PIX-CPF ativo em algum banco?
- [ ] Pré-preenchida usada (não declaração do zero)?
- [ ] Modelo (completo vs simplificado) calculado para máxima restituição?
- [ ] Sem divergências flagrantes que mandariam para malha?
- [ ] CPF do declarante e dependentes em situação regular?
- [ ] Transmissão na **primeira semana** do prazo (para 1º lote)?
- [ ] Recibo da declaração salvo em local seguro?
