# Integrações Externas — Ferramentas Complementares

A skill `irpf-brasil` é orientada a **conhecimento e auditoria** — não calcula imposto nem importa dados de corretoras. Para essas tarefas operacionais, use as ferramentas de terceiros listadas abaixo.

## 1. `irpf-investidor` — Cálculo de preço médio de ações/FIIs/ETFs

**Quando usar**: você opera na bolsa brasileira (B3) e precisa apurar **custos de aquisição** (preço médio com emolumentos e taxa de liquidação) para a ficha "Bens e Direitos" do IRPF.

### Características

| Item | Detalhe |
|---|---|
| **Repositório** | https://github.com/staticdev/irpf-investidor |
| **Linguagem** | Python ≥ 3.11 |
| **Licença** | MIT |
| **Última versão** | Maio/2025 (manutenção ativa) |
| **Suporta** | Ações, FIIs, ETFs |
| **NÃO suporta** | Day trade, contratos futuros, IBrX-50 |

### Instalação

```bash
pip install irpf-investidor
```

> Pré-requisito: locale `pt_BR` configurado no SO. No Windows, geralmente já vem.

### Fluxo de uso

1. Acessar **Área do Investidor B3** (https://www.investidor.b3.com.br).
2. Em "Movimentações" → exportar relatório de negociações em **Excel (.xls)** chamado `InfoCEI.xls`.
3. Salvar arquivo na pasta atual ou em `~/Downloads`.
4. Rodar:
   ```bash
   irpf-investidor
   ```
5. O programa imprime na tela:
   - Preço médio por ativo.
   - Custos (emolumentos, taxa de liquidação).
   - Custo total para "Situação em 31/12".

### Como integrar com a skill

Quando o usuário tiver renda variável significativa:

1. Skill carrega `reference/renda-variavel-revar.md`.
2. Recomenda ao usuário rodar `irpf-investidor` como **segunda fonte** para cruzar com o REVAR da Receita.
3. Se REVAR e irpf-investidor divergirem, sinaliza para o usuário verificar:
   - Eventos corporativos (splits, bonificações).
   - Operações em corretora não conectada à B3 oficial.
   - Período de cobertura (REVAR cobre 2019+).

### Limitações

- **Aviso oficial**: "responsabilidade de conferência dos valores e do envio dessas informações à Receita Federal é do usuário".
- **Sem GUI**: apenas CLI (terminal).
- **InfoCEI antigo**: a B3 unificou o portal em 2021. Versões mais antigas usam outro formato — ver `staticdev/irpf-cei` (legado).
- **Day trade**: a skill `irpf-brasil` cobre regras (alíquota 20%) mas não calcula. Ferramentas alternativas: planilha manual ou serviço pago (Bastter, GuiaInvest).

---

## 2. `darf_generator` — Geração de DARF de bolsa

**Quando usar**: você teve **lucro líquido tributável** em algum mês e precisa gerar o DARF código **6015** para recolhimento.

| Item | Detalhe |
|---|---|
| **Repositório** | https://github.com/renanleonellocastro/darf_generator |
| **Linguagem** | Python 3 |
| **Status** | Em desenvolvimento |
| **Função** | Calcula IR mensal sobre operações + gera boleto DARF |

> Use com cautela. **Sempre valide** o DARF gerado contra o Sicalc oficial (https://sicalc.receita.fazenda.gov.br) antes de pagar.

---

## 3. `RafaelEstevamReis/IRPF` — Documentação de leiaute DBK/DEC

**Quando usar**: você precisa entender a estrutura interna dos arquivos DBK/DEC para parsing customizado.

| Item | Detalhe |
|---|---|
| **Repositório** | https://github.com/RafaelEstevamReis/IRPF |
| **Linguagem** | C# |
| **Status** | Pasta `Docs/Gerada/2025/` tem leiaute em markdown |
| **Cobertura** | Leiautes oficiais de 2017, 2018, 2019, 2023; gerado a partir de XML para 2019, 2020, 2025 |
| **Documento principal** | [LayoutDadosDIRPF2025.md](https://raw.githubusercontent.com/RafaelEstevamReis/IRPF/master/Docs/Gerada/2025/LayoutDadosDIRPF2025.md) (140 KB) |

### Conteúdo útil

- **Tabelas de campos** por tipo de registro (16, 19, 21, 23, 24, 26, 27, 40, 41, 84, 85, 86, 87, 88, etc).
- **Posições e tamanhos** de cada campo.
- **Tipos de dados** (N=numérico, C=caracter, A=alfa).

### Limitação importante

O leiaute publicado é o do **arquivo DEC** (transmitido). O **DBK** (rascunho local) pode ter pequenas variações:

- Campos novos (`COD_ALTCOIN`, `COD_STABLECOIN`, `IN_PROCESSO_ATUALIZACAO_BEM`) podem estar omitidos no DBK.
- Campo `NM_PAIS` (40 chars) pode não ser preenchido no DBK quando o bem é nacional.

A skill `irpf-brasil` usa offsets **híbridos**: leiaute oficial para campos básicos + observação empírica para registros com discrepâncias.

---

## 4. Outras ferramentas brasileiras úteis

| Projeto | Função | Link |
|---|---|---|
| `staticdev/irpf-cei` | Versão antiga (B3 antes da unificação 2021) | https://github.com/staticdev/irpf-cei |
| `guilhermecgs/ir` | Selenium para extrair dados do CEI | https://github.com/guilhermecgs/ir |
| `MestreLion/irpf` | Instalador IRPF para Linux (Flatpak) | https://github.com/MestreLion/irpf |
| `andresmrm/docker-irpf` | Container Docker para rodar programa IRPF | https://github.com/andresmrm/docker-irpf |
| `rochacbruno/irpf-docker` | Imagem Docker alternativa | https://github.com/rochacbruno/irpf-docker |

---

## 5. Programa oficial da Receita Federal — única fonte autoritativa

Para **transmitir** a declaração, somente o programa oficial da RFB serve:

- **Download**: https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda
- **Online (Meu IR)**: https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda — versão web simplificada (cobre maioria dos casos comuns).
- **App Receita Federal** (Android/iOS) — para consultas pós-transmissão.
- **e-CAC**: https://cav.receita.fazenda.gov.br — autenticação Gov.br para acesso à pré-preenchida e situação fiscal.

---

## Conhecimento contábil profundo (não-skill)

Para casos complexos (PJ, MEI, lucro presumido, planejamento sucessório, holdings):

- **Roberto Dias Duarte (RDD10+)**: https://www.robertodiasduarte.com.br/ — referência em IA + contabilidade no Brasil. Cursos pagos.
- **Conselho Federal de Contabilidade (CFC)**: https://cfc.org.br/ — guias oficiais e cartilhas.
- **Receita Federal — Perguntas e Respostas IRPF**: https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/perguntas-e-respostas/dirpf/ — manual oficial atualizado anualmente.

> Para situações com risco fiscal alto (controle societário, ativos no exterior > R$ 1M, espólio, holding patrimonial), **sempre consultar contador habilitado**.
