# Scripts da skill `irpf-brasil`

## `parse_dbk.py` — Parser e auditor de DBK/DEC

Lê arquivos de backup do programa IRPF (.DBK rascunho ou .DEC transmitido) e gera relatório de auditoria com:
- Contagem de registros por tipo.
- Distribuição de Bens e Direitos por grupo.
- Detecção de ativos no exterior (Lei 14.754/2023).
- Heurísticas de malha fina (pagamentos sem nome, duplicidade fonte 21/84, etc).

### Pré-requisitos
- **Python ≥ 3.9** (stdlib only — sem dependências externas).

### Uso básico

```bash
python parse_dbk.py "caminho/SEUCPF-IRPF-A-2026-2025-ORIGI.DBK"
```

Gera arquivo `<nome>.audit.md` ao lado do DBK.

### Opções

| Flag | Descrição |
|---|---|
| `-o` / `--output` | Caminho customizado do relatório de saída |
| `--include-values` | Inclui valores agregados (totais) no relatório. Default: omite valores para privacidade. |

### Exemplo com saída customizada

```bash
python parse_dbk.py minha-declaracao.DBK -o ~/auditoria.md --include-values
```

### Saída

O relatório é em **markdown**, com:

1. Header com metadados (CPF mascarado, ano, total de registros).
2. Tabela de tipos de registro (16, 19, 20, 21, 23, 24, 26, 27, 40, 41, 84, 86, 88, T9).
3. Distribuição de Bens e Direitos por grupo (imóveis, veículos, FIIs, etc).
4. Lista de ativos no exterior (se houver).
5. Findings da auditoria com severidade:
   - 🔴 **CRITICO** — corrigir antes de transmitir.
   - 🟠 **ALERTA** — verificar com atenção.
   - 🟡 **ATENCAO** — revisar.
   - 🔵 **INFO** — informativo.

### Privacidade

Por padrão o script **não expõe** valores monetários nem nomes de prestadores no relatório. CPF e CNPJ são **mascarados** (mostram apenas primeiro e último grupo).

Para incluir valores agregados (totais somados, sem detalhamento), use `--include-values`.

### Limitações

- O leiaute é baseado em **engenharia reversa** — campos de offset podem variar entre versões do programa IRPF.
- Não substitui o programa oficial da RFB para preenchimento ou transmissão.
- Não decodifica todos os campos — focado em estrutura agregada e auditoria heurística.
- Apenas leitura. **Não modifica o arquivo DBK**.

### Integração com a skill

Quando o usuário tem um DBK e pede auditoria, fluxo recomendado:

1. Carregar `reference/dbk-parsing.md` para entender o formato.
2. Rodar `scripts/parse_dbk.py` no arquivo do usuário.
3. Cruzar findings do relatório com as regras dos arquivos:
   - `obrigatoriedade.md` (limites)
   - `deducoes-modelos.md` (modelo completo vs simplificado)
   - `pre-preenchida-nucleo.md` (Núcleo Familiar)
   - `renda-variavel-revar.md` (REVAR/B3)
   - `renda-fixa.md` (CDB/Tesouro/LCI)
   - `bets-apostas.md` (apostas)
   - `malha-fina-esocial.md` (e-Social/EFD-Reinf)
   - `restituicao-cashback.md` (lotes/Cashback)
4. Gerar recomendações finais ao usuário.
