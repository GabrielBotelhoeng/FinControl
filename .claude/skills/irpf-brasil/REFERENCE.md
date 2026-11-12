# IRPF Brasil — Índice de Referências

Esta skill segue o padrão de **progressive disclosure**: o `SKILL.md` carrega apenas o esqueleto operacional. Os detalhes regulatórios ficam aqui, em arquivos especializados que devem ser carregados **sob demanda** conforme o tema da conversa.

## Quando carregar cada arquivo

| Arquivo | Carregar quando o usuário mencionar |
|---|---|
| `reference/obrigatoriedade.md` | "preciso declarar?", "sou obrigado?", limites, salário, bens, atividade rural, bolsa de valores |
| `reference/deducoes-modelos.md` | "completa ou simplificada?", "vale a pena deduzir?", dependentes, educação, saúde, previdência |
| `reference/pre-preenchida-nucleo.md` | "pré-preenchida", "Núcleo Familiar", "incluir dependente", "Gov.br", "e-CAC" |
| `reference/renda-variavel-revar.md` | "ações", "B3", "day trade", "FII", "fundos imobiliários", "REVAR", "ganho líquido", "swing trade" |
| `reference/renda-fixa.md` | "CDB", "Tesouro Direto", "LCI", "LCA", "fundo DI", "tabela regressiva" |
| `reference/bets-apostas.md` | "bets", "aposta esportiva", "cassino online", "ComprovaBet", "Lei 14.790", "Bet365", "Sportingbet" |
| `reference/malha-fina-esocial.md` | "malha fina", "divergência", "informe", "e-Social", "EFD-Reinf", "DIRF", "13º", "S-5002", "reprocessamento" |
| `reference/restituicao-cashback.md` | "restituição", "lote", "Cashback IRPF", "PIX restituição", "prioridade", "idoso restituição" |
| `reference/dbk-parsing.md` | ".DBK", ".DEC", ".REC", "backup IRPF", "ler arquivo declaração", "parsear", "decodificar IRPF" |
| `reference/integracoes-externas.md` | "irpf-investidor", "darf_generator", "ferramenta auxiliar", "calcular preço médio", "InfoCEI", "B3 exportar" |
| `reference/mudancas-2026-2027.md` | "Lei 15.270/2025", "isenção R$ 5 mil", "IRPFM", "imposto mínimo", "tributação dividendos 10%", "nome social", "raça cor", "planejamento 2026", "novidades 2027" |
| `reference/ganho-capital-imoveis.md` | "GCAP", "ganho de capital", "vender imóvel", "alienação", "isenção 180 dias", "isenção R$ 440 mil", "Lei 14.973", "DARF 4600", "permuta", "doação herança bem" |
| `reference/casos-especiais.md` | "espólio", "inventário", "falecimento", "herança", "saída definitiva", "expatriação", "residência fiscal", "MEI", "DASN-SIMEI", "lucro distribuível", "PCD", "doença grave", "isenção aposentado", "atividade rural", "DITR", "Carnê-Leão", "doação ITCMD", "declaração conjunta cônjuge" |
| `reference/investimentos-exterior.md` | "Lei 14.754/2023", "antidiferimento", "entidade controlada", "offshore", "trust", "Settlor", "Trustee", "paraíso fiscal", "renda passiva 40%", "PTAX 31/12", "imposto pago no exterior", "1099", "withholding tax", "variação cambial", "USD 5.000", "CRS" |

## Topologia de dependência

Alguns temas se cruzam. Quando isso acontecer, carregue múltiplos arquivos:

- **Dependente trabalhador** → `pre-preenchida-nucleo.md` + `obrigatoriedade.md`
- **Bolsa + malha fina** → `renda-variavel-revar.md` + `malha-fina-esocial.md`
- **Bets offshore não declarado** → `bets-apostas.md` + `malha-fina-esocial.md`
- **Aposentado com aplicações** → `renda-fixa.md` + `restituicao-cashback.md` (prioridade 60+/80+)

## Prioridade de carregamento

Em conversas longas com múltiplos temas, **descarregue** arquivos que não são mais relevantes para liberar contexto. A skill foi desenhada para que cada arquivo de referência seja autossuficiente (não há cross-references obrigatórios entre eles).
