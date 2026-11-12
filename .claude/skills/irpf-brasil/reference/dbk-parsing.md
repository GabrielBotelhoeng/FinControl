# Parsing de Arquivos .DBK / .DEC / .REC do IRPF

## Tipologia dos arquivos do programa IRPF

| Extensão | O que é | Quando é gerado |
|---|---|---|
| `.DBK` | Backup da declaração **em rascunho** (em edição) | Automático ao salvar dentro do programa |
| `.DEC` | Backup da declaração **transmitida** | Após o envio à RFB |
| `.REC` | **Recibo** de transmissão (comprovante de entrega) | Após o envio bem-sucedido |
| `.DDA` | Dados do declarante atualizados (cache local) | Pelo programa em runtime |

> **DBK e DEC têm o mesmo leiaute** (texto ASCII posicional). O `REC` é diferente — é o recibo da transmissão e contém apenas dados de protocolo.

## Estrutura geral do DBK/DEC

- **Encoding**: ASCII com terminadores **CRLF** (Windows).
- **Estrutura**: 1 registro = 1 linha. Cada linha começa com **2 caracteres** que identificam o tipo de registro.
- **Header** (linha 1): inicia com a string literal `IRPF` seguida de espaços.
- **Trailer** (última linha): inicia com `T9` e contém contadores de cada tipo de registro.
- **Campos**: posicionais (offsets fixos) — **NÃO** são separados por delimitador.
- **Valores monetários**: armazenados como **inteiros em centavos** sem ponto decimal (ex: `0000000123456` = R$ 1.234,56).
- **CPF**: 11 dígitos sem máscara.
- **CNPJ**: 14 dígitos sem máscara.
- **Datas**: `DDMMAAAA` ou `DDMMAA` (varia por campo).

## Catálogo de tipos de registro (observados em IRPF 2026)

> ⚠️ **A RFB não publica especificação oficial** detalhada do leiaute DBK/DEC para o público. As informações abaixo foram inferidas por engenharia reversa de declarações reais e validação cruzada. Use com cautela e sempre confirme posições antes de extrair valores.

| Código | Conteúdo | Quantidade típica |
|---|---|---|
| `IR` | Header da declaração (versão programa, OS, ano-base) | 1 |
| `16` | Identificação do contribuinte (nome, endereço, CPF, e-mail, telefone) | 1 |
| `19` | Cônjuge (CPF, data nascimento, ocupação) — zerado se não houver | 1 |
| `20` | Sumário/totalizadores da declaração | 1 |
| `21` | Fonte pagadora pessoa jurídica (rendimentos tributáveis) | N (1 por fonte) |
| `22` | Fonte pagadora pessoa física | N |
| `23` | Dependentes (CPF, data nascimento, parentesco) | N |
| `24` | Alimentandos (CPF de quem recebe pensão judicial) | N |
| `25` | Atividade rural | 0+ |
| `26` | Pagamentos efetuados (médicos, educação, advogados) | N |
| `27` | **Bens e Direitos** (imóveis, veículos, contas, ações, FIIs) | N |
| `40` | Apuração mensal Carnê-Leão (12 linhas, jan-dez) | 12 |
| `41` | Totalizador anual do Carnê-Leão | 1 |
| `42` | Imposto pago no exterior | 0+ |
| `43` | Doações com benefício fiscal | 0+ |
| `82` | Espólio | 0+ |
| `84` | Tributação Exclusiva/Definitiva (PLR, lucros, JCP) | N |
| `85` | Rendimentos isentos (genéricos) | 0+ |
| `86` | Rendimentos de FIIs (isentos) | N |
| `87` | Rendimentos da poupança/LCI/LCA | 0+ |
| `88` | Rendimentos isentos PJ (dividendos, JCP de empresas) | N |
| `89` | Lucro distribuído de pessoa jurídica | 0+ |
| `90` | Atualização do programa | 0+ |
| `T9` | Trailer (contadores de cada tipo de registro) | 1 |

## Mapeamento de campos identificados (validado em IRPF 2026)

### Registro `16` — Identificação

| Posição | Tamanho | Conteúdo |
|---|---|---|
| 1-2 | 2 | "16" |
| 3-13 | 11 | CPF |
| 14-73 | 60 | Nome completo |
| 74-88 | 15 | Tipo logradouro |
| 89-128 | 40 | Logradouro |
| 129-134 | 6 | Número |
| 135-156 | 22 | Complemento |
| 157-175 | 19 | Bairro |
| 176-183 | 8 | CEP (8 dígitos) |
| 184-187 | 4 | Código IBGE município |
| 188-227 | 40 | Município |
| 228-229 | 2 | UF |
| 230-232 | 3 | País (105 = Brasil) |
| 233-282 | 50 | E-mail |
| ... | ... | DDD + telefone, data nascimento, ocupação |

### Registro `27` — Bens e Direitos

| Posição | Tamanho | Conteúdo |
|---|---|---|
| 1-2 | 2 | "27" |
| 3-13 | 11 | CPF |
| 14-15 | 2 | Grupo (01=Imóveis, 03=Veículos, 04=Aplicações financeiras, 06=Depósitos, 07=Fundos imobiliários, 08=Cripto) |
| 16-17 | 2 | Código específico do grupo |
| 18-19 | 2 | País (105 = Brasil; 249 = EUA; 1249 = Cayman; etc) |
| 20-... | ~511 | Discriminação textual (descrição livre) |
| ... | 13 | Valor em 31/12 do ano-base (centavos) |
| ... | 13 | Valor em 31/12 do ano-base anterior (centavos) |
| ... | vários | Localização (logradouro, CEP, UF, município) — opcional para imóveis |
| ... | 14 | CNPJ da fonte custodiante |
| ... | ... | Ticker (para ações/FIIs), código da ação |

> A largura total varia por subgrupo. Para imóveis há campos adicionais de localização e matrícula.

### Registro `26` — Pagamentos efetuados

| Posição | Tamanho | Conteúdo |
|---|---|---|
| 1-2 | 2 | "26" |
| 3-13 | 11 | CPF |
| 14-15 | 2 | Tipo (10=Despesa médica, 21=Médico de outra natureza, 70=Pensão, etc) |
| 16-17 | 2 | Subtipo |
| 18-31 | 14 | CNPJ ou CPF do prestador (zeros se não preenchido) |
| 32-91 | 60 | Nome do prestador |
| 92-104 | 13 | Valor pago em centavos |
| 105-117 | 13 | Parcela não-dedutível (reembolso plano de saúde) |
| ... | 13 | Outros valores |
| ... | 1 | Tipo de beneficiário (T=Titular, D=Dependente) |
| ... | ... | Discriminação adicional |

### Registro `84` — Tributação Exclusiva/Definitiva

| Posição | Tamanho | Conteúdo |
|---|---|---|
| 1-2 | 2 | "84" |
| 3-13 | 11 | CPF |
| 14 | 1 | Tipo beneficiário (T) |
| 15-25 | 11 | CPF do declarante (repetido) |
| 26-29 | 4 | Sequencial |
| 30-31 | 2 | Código rendimento (12=Outros, 09=Lucros distribuídos PLR) |
| 32-45 | 14 | CNPJ fonte |
| 46-105 | 60 | Nome fonte |
| 106-118 | 13 | Valor recebido (centavos) |
| 119-... | 13 | IR retido na fonte (centavos) |

### Registro `88` — Rendimentos Isentos PJ

| Posição | Tamanho | Conteúdo |
|---|---|---|
| 1-2 | 2 | "88" |
| 3-13 | 11 | CPF |
| 14-... | ... | Tipo beneficiário (T/D) |
| ... | 14 | CNPJ fonte pagadora |
| ... | 60 | Nome fonte pagadora |
| ... | 13 | Valor recebido (centavos) |
| ... | ... | Código do tipo de rendimento isento |

### Registro `86` — Rendimentos de FIIs

| Posição | Tamanho | Conteúdo |
|---|---|---|
| 1-2 | 2 | "86" |
| 3-... | ... | CPF + identificadores |
| ... | 14 | CNPJ do FII |
| ... | 60 | Nome do FII |
| ... | 13 | Rendimento isento recebido (centavos) |
| ... | 60 | Discriminação |
| ... | 13 | Outro valor |

### Registro `T9` — Trailer

| Posição | Tamanho | Conteúdo |
|---|---|---|
| 1-2 | 2 | "T9" |
| 3-13 | 11 | CPF |
| 14-18 | 5 | Total geral de registros |
| 19-... | 5 cada | Quantidade de cada tipo (16, 19, 20, 21, 22, 23, 24, ..., 88) |
| Final | 11 | Hash/checksum |

## Recursos externos

### Documentação oficial RFB

A RFB **não publica diretamente** o leiaute do DBK/DEC para o público em geral. Mas há documentação derivada do XML interno do programa IRPF disponível em projetos comunitários:

- 🥇 **[LayoutDadosDIRPF2025.md](https://raw.githubusercontent.com/RafaelEstevamReis/IRPF/master/Docs/Gerada/2025/LayoutDadosDIRPF2025.md)** — leiaute completo do IRPF 2025 em markdown (140 KB). Lista TODOS os tipos de registro (16, 19, 21-99, etc) com nome, posição, tamanho e tipo de cada campo. **Esta é a fonte que o `parse_dbk.py` da skill usa**.
- [LeiauteTXT 2023 (PDF)](https://raw.githubusercontent.com/RafaelEstevamReis/IRPF/master/Docs/Oficial/IRPF-LeiauteTXT_2023.pdf) — versão PDF original publicada pela RFB no site do programa IRPF.
- [Manual do programa IRPF](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda) — descreve uso do programa, não formato.
- [Perguntas e Respostas IRPF 2026](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/perguntas-e-respostas/dirpf/) — orientações ao contribuinte.

> Profissionais que desenvolvem softwares fiscais comerciais (Bastter, KingHost, escritórios contábeis) negociam acesso direto com a RFB ou usam reverse engineering.

### Divergência DBK vs DEC

O leiaute publicado é o do **arquivo DEC** (transmitido). O **DBK** (rascunho local) tem variações observadas em IRPF 2026:

- Campo `NM_PAIS` (40 chars) no Tipo 27 pode ser **omitido** quando o bem é nacional, deslocando offsets posteriores em -40.
- Campos novos introduzidos pela Lei 14.973/2024 (atualização de bens) podem variar entre versões.
- O parser da skill usa **offsets híbridos**: oficiais para campos já validados (16, 26, 84, 88) + observação empírica para 27.

### Projetos open-source no GitHub
Não há parser maduro e dedicado a DBK/DEC do IRPF pessoa física. Projetos relacionados:

| Projeto | Foco | Útil para... |
|---|---|---|
| [`felipewer/irpf`](https://github.com/felipewer/irpf) | Programa de declaração alternativo | Estudo de estrutura |
| [`staticdev/irpf-investidor`](https://github.com/staticdev/irpf-investidor) | Importar notas de corretagem | Cálculo de bens em ações |
| [`staticdev/irpf-cei`](https://github.com/staticdev/irpf-cei) | Calcular custos de ETFs/FIIs | Validar preços médios |
| [`MestreLion/irpf`](https://github.com/MestreLion/irpf) | Instalador IRPF para Linux | Rodar programa oficial fora do Windows |
| [`andresmrm/docker-irpf`](https://github.com/andresmrm/docker-irpf) | IRPF em container | Isolamento ambiente |
| [`rochacbruno/irpf-docker`](https://github.com/rochacbruno/irpf-docker) | Imagem Docker IRPF | Idem |

> **Conclusão**: para parsing real, é necessário **escrever um parser próprio** baseado em offsets observados (ver script `scripts/parse_dbk.py` da skill).

## Aviso de privacidade

Arquivos DBK/DEC contêm:
- CPF do declarante e dependentes
- Endereço completo
- Salários, rendimentos, bens
- Saldos bancários, posições de investimentos
- CNPJs de fontes pagadoras
- Despesas médicas (que revelam condições de saúde)
- Pensão alimentícia (revela situação familiar)

**Manuseio seguro**:
- Nunca enviar DBK/DEC para serviços online não-fiscais.
- Não fazer upload de DBK em ferramentas de IA generativa em chat público.
- Manter o arquivo localmente, criptografado se possível (BitLocker, VeraCrypt).
- Se compartilhar com contador, preferir canais com criptografia (e-mail seguro, WeTransfer com senha, ou pasta compartilhada com permissão restrita).
- Após aceitar a declaração, manter o DBK/DEC + REC por **5 anos** (prazo decadencial RFB).

## Como usar a skill com um arquivo DBK

A skill `irpf-brasil` inclui o script `scripts/parse_dbk.py` (Python stdlib only) que:

1. Lê o DBK e estatística por tipo de registro.
2. Extrai estrutura agregada (sem expor valores sensíveis).
3. Cruza contra as regras dos 8 arquivos de referência da skill.
4. Gera um relatório `.md` de auditoria pré-transmissão.

Uso:
```bash
python scripts/parse_dbk.py <caminho-do-arquivo.dbk> [--output relatorio.md]
```

Ver `scripts/README.md` para detalhes.

## Limitações conhecidas

1. **Não decodifica todos os campos** — apenas os que foram validados por engenharia reversa.
2. **Não substitui o programa oficial** da RFB para preencher ou transmitir.
3. **Pode falhar em versões futuras** se a RFB mudar o leiaute (raro entre anos consecutivos).
4. **Não interpreta DEC** que tenha sido **criptografado** (não vimos casos, mas é tecnicamente possível).
5. **Não decodifica REC** — o recibo é binário e tem outro formato.

## Quando NÃO usar parsing

- Se o objetivo for editar a declaração: **use o programa oficial**, sempre.
- Se o objetivo for transmitir: **somente o programa oficial** transmite via Receitanet.
- Se o usuário não está confortável com programas externos: orientar uso direto do programa.

A skill é para **auditoria, leitura e cruzamento de dados** — não para preenchimento ou transmissão.
