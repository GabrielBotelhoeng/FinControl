# Modelos de Declaração e Deduções — IRPF 2026

## Decisão central: Completa vs Simplificada

A escolha entre os dois modelos é **mutuamente exclusiva** e impacta diretamente o imposto a pagar/restituir. O programa da Receita oferece comparação automática, mas a skill deve **fazer o teste matemático antes** para que o usuário entenda o porquê.

### Modelo Simplificado

- Aplica desconto padrão de **20%** sobre a soma dos rendimentos tributáveis.
- Esse desconto **substitui inteiramente** todas as deduções legais permitidas.
- Limite máximo do desconto: **R$ 16.754,34** (mantido em relação ao ano anterior).
- Não exige nenhuma comprovação de despesas.

**Quando usar:**
- Renda anual baixa/média (até ~R$ 100.000) com poucas despesas dedutíveis.
- Pessoa sem dependentes, sem plano de saúde particular, sem despesas médicas relevantes.
- Quem já bateu o teto de R$ 16.754,34 com 20% e não tem comprovantes.

### Modelo Completo (com deduções discriminadas)

Permite somar deduções específicas, sujeitas a limites individuais e regras de elegibilidade.

| Dedução | Limite | Observações |
|---|---|---|
| **Dependentes** | R$ 2.275,08 por dependente/ano | CPF obrigatório |
| **Educação** | R$ 3.561,50 por pessoa/ano | Apenas instrução formal — ver lista de exclusões abaixo |
| **Despesas médicas** | **Sem teto** | Comprovante obrigatório (NF, recibo com CPF) |
| **Previdência privada PGBL** | 12% da renda tributável | Só PGBL — VGBL não deduz |
| **Pensão alimentícia judicial** | Sem teto | Apenas com decisão judicial ou escritura pública |
| **INSS / Previdência oficial** | Sem teto | Já vem na pré-preenchida |
| **Livro Caixa** (autônomo) | Despesas necessárias | Apenas para profissionais liberais |
| **Doações** (FIA, esporte, idoso, oncologia) | 6% somando todas | Comprovante específico |

## Algoritmo de decisão

```
1. Somar TODAS as deduções discriminadas válidas:
   total_completo = dependentes + educacao + saude + previdencia + pensao + livro_caixa + doacoes

2. Calcular limite simplificado:
   simplificado = min(rendimento_tributavel * 0,20 ; R$ 16.754,34)

3. Comparar:
   - Se total_completo > simplificado → escolher COMPLETA
   - Se total_completo < simplificado → escolher SIMPLIFICADA
   - Se igual → indiferente; preferir simplificada (menos risco de auditoria)

4. Calcular o ganho fiscal:
   diferenca_base = |total_completo - simplificado|
   economia_estimada = diferenca_base * aliquota_marginal_efetiva
```

## Tabela progressiva anual IRPF 2026 (ano-base 2025)

Atenção: é a tabela aplicada **sobre a base anual de 2025**, não a tabela mensal. Conforme IN RFB nº 2.312/2026:

| Base de cálculo anual | Alíquota | Parcela a deduzir |
|---|---|---|
| Até R$ 29.145,60 | 0% | — |
| De R$ 29.145,61 a R$ 33.919,80 | 7,5% | R$ 2.185,92 |
| De R$ 33.919,81 a R$ 45.012,60 | 15% | R$ 4.729,91 |
| De R$ 45.012,61 a R$ 55.976,16 | 22,5% | R$ 8.105,85 |
| Acima de R$ 55.976,16 | 27,5% | R$ 10.904,66 |

### Isenção adicional para aposentados 65+

Aposentados, pensionistas e reformados com **65 anos ou mais** (em qualquer mês de 2025) têm direito a isenção mensal sobre rendimentos de aposentadoria/pensão:
- **Limite mensal**: R$ 1.903,98 (sobre o rendimento de aposentadoria/pensão recebido de fonte oficial — INSS/Tesouro/regime estadual ou municipal/previdência complementar).
- **Limite anual**: aproximadamente R$ 24.751,74 (incluindo a parcela isenta sobre 13º salário).
- A parcela que **excede** R$ 1.903,98/mês entra na base tributável normalmente.
- A isenção aplica-se **apenas** a aposentadoria/pensão — outros rendimentos (aluguel, salário) são tributados normalmente.

Esses valores aparecem na pré-preenchida importados via e-Social. Verifique que a "Parcela Isenta — 65 anos" foi corretamente classificada no informe da fonte pagadora.

## Despesas com Educação — Regras Rígidas

A dedução de educação é o **principal vetor de auditoria**. A IA deve recusar lançamentos inválidos antes de calcular.

### O que ENTRA (dedutível, até R$ 3.561,50 por pessoa/ano):

- Educação infantil (creche e pré-escola).
- Ensino fundamental e médio.
- Ensino técnico de nível médio.
- Ensino superior (graduação e pós-graduação stricto sensu — mestrado, doutorado).
- Educação profissional (técnico e tecnológico, conforme LDB).

### O que NÃO ENTRA (rejeitar imediatamente):

- ❌ Cursos de **idiomas** (inglês, espanhol, etc).
- ❌ Cursos de **informática**.
- ❌ Cursos de **música**, **arte**, **dança**, **esportes**.
- ❌ **Material escolar** (livros, cadernos, mochilas, uniformes).
- ❌ **Transporte escolar** e **alimentação** (lanche, almoço).
- ❌ **Cursos pré-vestibulares** e **preparatórios para concurso**.
- ❌ **Cursos livres** em geral (extensão, oratória, MBA executivo de curta duração que não seja stricto sensu).
- ❌ **Pós-graduação lato sensu** (especialização, MBA) — apesar de comum, NÃO é dedutível.

> A pós lato sensu é controversa — a Receita tem aceitado em alguns casos, mas o entendimento padrão é de que não é dedutível. Em caso de dúvida, **não declarar** para evitar malha fina.

## Despesas médicas — Sem teto, mas com armadilhas

### O que ENTRA:

- Consultas médicas e odontológicas.
- Exames laboratoriais e de imagem.
- Cirurgias, internações hospitalares.
- Plano de saúde (titular + dependentes).
- Próteses dentárias e ortodônticas.
- Aparelhos auditivos, cadeira de rodas, marca-passo, bolsa de ostomia.
- Psicólogo, psiquiatra, fisioterapeuta, fonoaudiólogo, terapeuta ocupacional, nutricionista.

### O que NÃO ENTRA:

- ❌ Medicamentos comprados em farmácia (exceto se incluídos na nota da internação hospitalar).
- ❌ Vacinas em geral (com exceções pontuais).
- ❌ Acompanhante (ainda que recomendado).
- ❌ Reembolsos recebidos do plano de saúde — devem ser **abatidos** do total declarado.
- ❌ Despesas estéticas sem indicação clínica.

### Validação obrigatória da skill:
1. Toda despesa médica > R$ 1.500 deve ter comprovante (NF eletrônica preferencialmente).
2. CPF/CNPJ do prestador é obrigatório no lançamento.
3. **Reembolso pelo plano de saúde** deve ser subtraído. Quem declarou R$ 5.000 de fisio mas teve R$ 3.500 reembolsado, declara apenas R$ 1.500 dedutível. Esse é um dos top 3 motivos de malha fina.

## Dependentes — Regras de elegibilidade

| Dependente | Condição |
|---|---|
| Cônjuge ou companheiro(a) | Convivência > 5 anos OU filho em comum |
| Filho/enteado | Até 21 anos. Até 24 anos se em ensino superior/técnico de 2º grau. **Sem limite de idade** se incapacitado física/mentalmente para trabalho. |
| Irmão/neto/bisneto sob guarda judicial | Mesmas regras de filho |
| Pais, avós, bisavós | Renda própria (tributável + isenta) **até R$ 28.467,20** em 2025 |
| Sogro(a) | Apenas se cônjuge for declarado como dependente |
| Menor pobre sob guarda judicial | Até 21 anos |
| Pessoa absolutamente incapaz (curatela) | Sem limite de idade |

### Regras temporais críticas:

- **Aniversário no ano-base**: se o filho/enteado completou 21 (ou 24, se universitário) em **qualquer mês de 2025** — mesmo que tenha sido em 02/01/2025 — pode ser declarado o ano inteiro como dependente.
- **Ingresso em ensino superior**: se em 2025 o filho de 22 anos começou a faculdade, pode ser declarado a partir desse ano até os 24.
- **Casamento no ano-base**: cônjuge é elegível desde o mês do casamento. Para o ano civil inteiro, considere a regra de convivência.
- **Falecimento do dependente**: pode declarar normalmente o ano inteiro do falecimento.

## Recomendação operacional

Antes de fechar, sempre rodar **simulação dupla** mentalmente:
1. Cenário A: Completa com todas as deduções discriminadas válidas.
2. Cenário B: Simplificada com 20%.

Apresentar ao usuário **a diferença em reais** entre as duas opções e a recomendação.
