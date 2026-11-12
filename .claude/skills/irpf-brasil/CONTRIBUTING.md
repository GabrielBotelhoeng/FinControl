# Contribuindo para skill-irpf-brasil

Obrigado pelo interesse em contribuir! Este é um projeto pessoal e amador, mas contribuições da comunidade são muito bem-vindas para mantê-lo útil e atualizado.

## 🎯 Tipos de contribuição bem-vindos

### ✅ Aceitas com prioridade

1. **Correções regulatórias** — atualização de valores, alíquotas, prazos com **fonte oficial citada** (IN RFB, Lei publicada, comunicado RFB).
2. **Novos casos não cobertos** — ex: atividades específicas (médico, advogado, criador de conteúdo digital), modalidades de investimento (debêntures incentivadas, FIPs).
3. **Melhorias no parser DBK** — offsets adicionais validados, suporte a versões antigas, mensagens de erro mais claras.
4. **Tradução / internacionalização** — versão en-US para residentes fiscais bilíngues.
5. **Correção de typos e clareza** — melhorias editoriais sempre bem-vindas.

### ⚠️ Avaliadas caso a caso

- Adição de exemplos no `SKILL.md` (manter total ≤ 6 para evitar inflar contexto).
- Refatoração estrutural dos arquivos de referência.
- Novos arquivos de referência (precisam justificar tema não coberto).

### ❌ Não aceitas

- Conteúdo gerado por LLM **sem verificação humana** (alucinações são frequentes em tributação).
- Orientações sem respaldo em legislação oficial.
- Material com **fins promocionais comerciais** (link para serviços pagos, etc).
- Mudanças que **comprometam o disclaimer** ou diluam a natureza amadora do projeto.
- Suporte a transmissão automatizada de declaração (essa é função exclusiva do programa RFB).

---

## 📋 Como contribuir

### 1. Abrir uma Issue primeiro (recomendado)

Antes de fazer um PR grande, **abra uma Issue** descrevendo:
- O problema/lacuna identificado.
- Sua proposta de solução.
- Fontes oficiais que sustentam a mudança.

Isso evita retrabalho.

### 2. Fork e branch

```bash
# Fork via GitHub UI

# Clonar seu fork
git clone https://github.com/SEU_USUARIO/skill-irpf-brasil.git
cd skill-irpf-brasil

# Criar branch descritiva
git checkout -b fix/correcao-aliquota-renda-fixa
# ou
git checkout -b feat/adicionar-secao-criptoativos-gcap
```

### 3. Padrões editoriais

#### Idioma
- **Português brasileiro** em todos os arquivos de conteúdo.
- Termos técnicos podem ficar em inglês (e.g., "Settlor", "ETF") com explicação.

#### Formato
- Markdown com extensão `.md` em UTF-8.
- Acentos nativos (ã, ç, é) — **nunca** HTML entities (`&atilde;`).
- Tamanho ideal de cada arquivo de referência: **5–14 KB**.
- Headings hierárquicos consistentes (`#` → `##` → `###`).
- Tabelas em markdown nativo.

#### Valores monetários
- Formato brasileiro: `R$ 35.584,00` (ponto milhar, vírgula decimal).
- Datas: `DD/MM/AAAA`.

#### Citações de legislação
Sempre incluir fonte:
```markdown
Conforme Instrução Normativa RFB nº 2.312/2026, art. 2º, inciso I,
o limite é de R$ 35.584,00.
```

### 4. Escrever um commit message claro

```
fix(deducoes): corrigir parcela a deduzir 3ª faixa para R$ 4.729,91

Valor anterior estava desatualizado (R$ 4.577,37 era de 2024).
Confirmado com IN RFB 2.312/2026 e Tabela IRPF 2026 oficial.

Fontes:
- https://www.gov.br/receitafederal/.../tabelas/2026
- IN RFB 2.312/2026
```

Use prefixos: `fix:` (correção), `feat:` (novo conteúdo), `docs:` (apenas docs/README), `refactor:` (estrutura sem mudar conteúdo), `chore:` (manutenção).

### 5. Abrir Pull Request

Descrição do PR deve incluir:

- **O quê**: o que está sendo mudado.
- **Por quê**: justificativa.
- **Fontes**: links para legislação, comunicados RFB, ou referências secundárias confiáveis.
- **Impacto**: quem usa essa parte da skill, o que muda no comportamento.

Template:

```markdown
## O que muda

Correção do valor X em arquivo Y.

## Por quê

Valor estava desatualizado / não refletia regulação atual.

## Fontes

- [IN RFB nº X.YYY/2026](https://link)
- [Comunicado RFB de DD/MM/YYYY](https://link)

## Impacto

Usuários que perguntarem sobre [tema] receberão valor correto.
Não há mudança de comportamento do parser/script.

## Checklist

- [ ] Conteúdo escrito em pt-BR
- [ ] Fontes oficiais citadas
- [ ] Acentuação UTF-8 nativa
- [ ] Sem dependências externas adicionadas
- [ ] DISCLAIMER.md continua válido
```

---

## 🔍 Code review

O autor revisará PRs em **base de melhor esforço** — projeto pessoal, sem SLA. Para PRs com:

- Fontes claras e mudanças bem justificadas → resposta em 7-14 dias.
- Sem fontes ou mudanças amplas → pode demorar mais ou ser rejeitado.

Sinta-se livre para **mencionar @Danielbluz** se uma Issue/PR ficar parado por mais de 30 dias.

---

## 🧪 Testando mudanças

### Para mudanças em arquivos de referência (.md)

Não há testes automatizados. Validação manual:

1. **Lint markdown**: usar `markdownlint` ou similar.
2. **Encoding**: verificar UTF-8 sem BOM.
3. **Triggers**: se modificar `SKILL.md`, garantir que description fica ≤ 1024 chars (limite Anthropic).

### Para mudanças no parser Python (`scripts/parse_dbk.py`)

```bash
# Testar com um DBK de exemplo (NÃO commitar DBK real — contém dados sensíveis)
python scripts/parse_dbk.py /tmp/test.DBK

# Verificar que não há dependência externa
python -c "import ast; tree = ast.parse(open('scripts/parse_dbk.py').read()); imports = [n.module if isinstance(n, ast.ImportFrom) else n.names[0].name for n in ast.walk(tree) if isinstance(n, (ast.Import, ast.ImportFrom))]; print(imports)"
# Deve listar apenas: argparse, sys, collections, pathlib (stdlib)
```

---

## 🚨 Política de privacidade (para contribuidores)

**JAMAIS commit dados pessoais reais**:

- ❌ Não commit arquivos `.DBK`, `.DEC`, `.REC` reais.
- ❌ Não commit CPFs, CNPJs reais (mesmo que parciais) em exemplos.
- ❌ Não commit screenshots de relatórios de auditoria com dados visíveis.
- ✅ Use dados sintéticos (CPFs e CNPJs gerados aleatoriamente com dígitos verificadores válidos).
- ✅ Para examples, use placeholders: `XXX.XXX.XXX-XX`.

Se você acidentalmente commitar dados sensíveis, **reporte imediatamente** via Issue privado para o autor.

---

## 📜 Código de conduta

- **Respeito mútuo** em discussões.
- **Foco em conteúdo**, não em pessoas.
- **Português brasileiro** preferencial nas Issues/PRs (mas inglês também aceito).
- **Sem promoção comercial** — se você quer divulgar seu serviço de contabilidade, faça em outro lugar.

Violações persistentes resultam em bloqueio do contribuidor.

---

## 🙏 Reconhecimento

Contribuidores serão listados em uma seção **Acknowledgments** do README quando o projeto atingir um número significativo de PRs aceitos.

---

## ❓ Dúvidas?

Abra uma Issue com label `question` ou mencione [@Danielbluz](https://github.com/Danielbluz) em qualquer PR.

**Não responderei** consultas fiscais individualizadas — para isso, **procure um contador habilitado**.
