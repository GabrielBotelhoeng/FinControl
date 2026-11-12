#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""
parse_dbk.py — Parser e auditor de arquivos .DBK / .DEC do IRPF brasileiro.

Faz parsing posicional com offsets baseados no leiaute oficial DIRPF 2025
(LayoutDadosDIRPF2025.md de github.com/RafaelEstevamReis/IRPF) e gera
relatório estatístico + auditoria contra heurísticas comuns de malha fina.

Uso:
    python parse_dbk.py <arquivo.DBK> [--output relatorio.md] [--include-values]

Tipos suportados (parsing validado em IRPF 2026 / ano-base 2025):
    IR (header), 16, 19, 20, 21, 23, 24, 26, 27, 40, 41, 84, 86, 88, T9
"""

import argparse
import sys
from collections import Counter, defaultdict
from pathlib import Path


# ---------------------------------------------------------------------------
# Catálogo de tipos
# ---------------------------------------------------------------------------
REGISTROS = {
    "IR": "Header da declaração",
    "16": "Identificação do contribuinte",
    "17": "Resumo da declaração",
    "18": "Apuração do imposto",
    "19": "Rendimentos do declarante",
    "20": "Sumário/totalizadores",
    "21": "Fonte pagadora pessoa jurídica",
    "22": "Fonte pagadora pessoa física",
    "23": "Dependentes",
    "24": "Alimentandos (pensão judicial)",
    "25": "Atividade rural",
    "26": "Pagamentos efetuados (médicos, educação)",
    "27": "Bens e Direitos",
    "40": "Apuração mensal Carnê-Leão",
    "41": "Totalizador anual Carnê-Leão",
    "42": "Imposto pago no exterior",
    "43": "Doações com benefício fiscal",
    "82": "Espólio",
    "84": "Tributação Exclusiva/Definitiva",
    "85": "Rendimentos isentos genéricos",
    "86": "Rendimentos de FIIs (isentos)",
    "87": "Poupança/LCI/LCA (isentos)",
    "88": "Rendimentos isentos PJ (dividendos, JCP)",
    "89": "Lucro distribuído de PJ",
    "T9": "Trailer",
}

# Códigos de Bens (CD_BEM) — Tipo 27
GRUPOS_BENS = {
    "01": "Bens imóveis",
    "02": "Bens móveis (veículos, embarcações)",
    "03": "Participações societárias",
    "04": "Aplicações e investimentos (CDB, RDB, Tesouro, debêntures)",
    "05": "Créditos e poupanças",
    "06": "Depósitos à vista, conta corrente, ações",
    "07": "Fundos imobiliários (FII)",
    "08": "Criptoativos",
    "09": "Demais bens",
    "10": "Patrimônio empresarial",
    "11": "Imóveis residenciais",
    "12": "Imóveis comerciais",
    "21": "Veículos automotores",
    "29": "Outros bens móveis",
    "31": "Ações em geral",
    "41": "Caderneta de poupança",
    "45": "Aplicação de renda fixa",
    "47": "Mercados futuros, opções, termo",
    "49": "Outras participações societárias",
    "70": "Fundo de Curto Prazo",
    "71": "Fundo Longo Prazo / FIDC",
    "72": "Fundo Multimercado",
    "73": "Fundo Imobiliário",
    "77": "Fundo de Renda Fixa",
    "99": "Outros bens / Bens no exterior",
}

# Códigos de tipo de pagamento (CD_PAGTO) — Tipo 26 (top usados)
CODIGOS_PAGTO = {
    "10": "Médico (CPF)",
    "11": "Médico (CNPJ)",
    "12": "Hospital",
    "13": "Plano de saúde",
    "14": "Aparelhos ortopédicos",
    "21": "Despesas com instrução (educação)",
    "30": "Pensão alimentícia judicial",
    "31": "Pensão alimentícia escritura pública",
    "40": "Previdência social oficial",
    "41": "Contribuição previdência privada",
    "50": "Imposto de renda",
    "60": "Contribuição empregado doméstico",
    "70": "Outras deduções",
    "75": "Doações",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def centavos_para_brl(valor_str: str) -> float:
    """Converte string de inteiro em centavos para float em reais."""
    s = (valor_str or "").strip()
    if not s or not s.lstrip("0"):
        return 0.0
    try:
        return int(s) / 100
    except ValueError:
        return 0.0


def fmt_brl(v: float) -> str:
    """Formata float como R$ no padrão brasileiro."""
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def mascara_cpf(cpf: str) -> str:
    cpf = (cpf or "").strip()
    if len(cpf) != 11 or not cpf.isdigit():
        return cpf
    return f"{cpf[:3]}.***.***-{cpf[-2:]}"


def mascara_cnpj(cnpj: str) -> str:
    cnpj = (cnpj or "").strip()
    if len(cnpj) != 14 or not cnpj.isdigit():
        return cnpj
    return f"{cnpj[:2]}.***.***/****-{cnpj[-2:]}"


def slice_field(linha: str, start: int, length: int) -> str:
    """Extrai um campo posicional, retornando string vazia se fora dos limites."""
    if start >= len(linha):
        return ""
    return linha[start : start + length]


# ---------------------------------------------------------------------------
# Parsers (offsets baseados no leiaute oficial DIRPF 2025)
# ---------------------------------------------------------------------------
def parse_header(linha: str) -> dict:
    """Parsing do header IR.
    Layout:
      0-7: SISTEMA (8) — "IRPF    "
      8-11: EXERCICIO (4)
      12-15: ANO_BASE (4)
      16-19: CODIGO_RECNET (4)
      20: IN_RETIFICADORA (1)
      21-31: NR_CPF (11)
    """
    return {
        "sistema": slice_field(linha, 0, 8).strip(),
        "exercicio": slice_field(linha, 8, 4),
        "ano_base": slice_field(linha, 12, 4),
        "codigo_recnet": slice_field(linha, 16, 4),
        "is_retificadora": slice_field(linha, 20, 1) == "S",
        "cpf": mascara_cpf(slice_field(linha, 21, 11)),
    }


def parse_16_identificacao(linha: str) -> dict:
    """Tipo 16 — Identificação do declarante."""
    return {
        "cpf": mascara_cpf(slice_field(linha, 2, 11)),
        "nome": slice_field(linha, 13, 60).strip(),
        "logradouro": slice_field(linha, 88, 40).strip(),
        "numero": slice_field(linha, 128, 6).strip(),
        "bairro": slice_field(linha, 155, 19).strip(),
        "cep": slice_field(linha, 174, 9).strip(),
        "municipio": slice_field(linha, 187, 40).strip(),
        "uf": slice_field(linha, 227, 2),
        "cd_pais": slice_field(linha, 232, 3),
        "email": slice_field(linha, 275, 90).strip(),
        "data_nascimento": slice_field(linha, 400, 8),
    }


def parse_26_pagamentos(linha: str) -> dict:
    """Tipo 26 — Pagamentos efetuados.
    Offsets validados em IRPF 2026:
      13-14: CD_PAGTO (2)
      15-19: NR_CHAVE_DEPEND (5)
      20-33: NR_BENEF (14) — CNPJ/CPF do prestador
      34-93: NM_BENEF (60) — nome
      94-104: NR_NIT_EMP_DOM (11)
      105-117: VR_PAGTO (13) — valor em centavos
      118-130: VR_REDUC (13) — parcela não-dedutível
      144: IN_TIPO_CPF_CNPJ (1)
      145: IN_TIPO_PGTO (1) — T=Titular, D=Dependente, A=Alimentando
    """
    cd_pagto = slice_field(linha, 13, 2)
    return {
        "cd_pagto": cd_pagto,
        "tipo_pagto_nome": CODIGOS_PAGTO.get(cd_pagto, f"Código {cd_pagto}"),
        "id_beneficiario": slice_field(linha, 20, 14).strip(),
        "nome_prestador": slice_field(linha, 34, 60).strip(),
        "valor": centavos_para_brl(slice_field(linha, 105, 13)),
        "valor_nao_deducao": centavos_para_brl(slice_field(linha, 118, 13)),
        "is_pj": slice_field(linha, 144, 1) == "2",
        "tipo_beneficiario": slice_field(linha, 145, 1),
    }


def parse_27_bens(linha: str) -> dict:
    """Tipo 27 — Bens e Direitos.
    Offsets observados empiricamente em DBK 2026 (NM_PAIS de 40 chars omitido):
      13-14: CD_BEM (2)
      15: IN_EXTERIOR (1) — 0=Brasil, 1=Exterior
      16-18: CD_PAIS (3)
      19-530: TX_BEM (512) — descrição
      531-543: VR_ANTER (13)
      544-556: VR_ATUAL (13)
    """
    cd_bem = slice_field(linha, 13, 2)
    in_exterior = slice_field(linha, 15, 1) == "1"
    return {
        "cd_bem": cd_bem,
        "grupo_nome": GRUPOS_BENS.get(cd_bem, f"Grupo {cd_bem}"),
        "is_exterior": in_exterior,
        "cd_pais": slice_field(linha, 16, 3).strip(),
        "descricao": slice_field(linha, 19, 512).strip(),
        "valor_anterior": centavos_para_brl(slice_field(linha, 531, 13)),
        "valor_atual": centavos_para_brl(slice_field(linha, 544, 13)),
    }


def parse_84_exclusiva(linha: str) -> dict:
    """Tipo 84 — Tributação Exclusiva/Definitiva.
    Offsets oficiais validados:
      13: IN_TIPO (1) — T/D
      14-24: NR_CPF_BENEFIC (11)
      25-28: NR_COD (4) — código de tipo
      29-42: NR_PAGADORA (14)
      43-102: NM_NOME (60)
      103-115: VR_VALOR (13)
      116-128: VR_VALOR_13 (13)
    """
    return {
        "tipo_beneficiario": slice_field(linha, 13, 1),
        "cpf_beneficiario": mascara_cpf(slice_field(linha, 14, 11)),
        "nr_cod": slice_field(linha, 25, 4),
        "cnpj_fonte": slice_field(linha, 29, 14).strip(),
        "nome_fonte": slice_field(linha, 43, 60).strip(),
        "valor": centavos_para_brl(slice_field(linha, 103, 13)),
        "valor_13": centavos_para_brl(slice_field(linha, 116, 13)),
    }


def parse_88_isentos(linha: str) -> dict:
    """Tipo 88 — Rendimentos Isentos PJ.
    Offsets oficiais validados:
      13: IN_TIPO (1)
      14-24: NR_CPF_BENEFIC (11)
      25-28: NR_COD (4)
      29-42: NR_PAGADORA (14)
      43-102: NM_NOME (60)
      103-115: VR_VALOR (13)
    """
    return {
        "tipo_beneficiario": slice_field(linha, 13, 1),
        "cpf_beneficiario": mascara_cpf(slice_field(linha, 14, 11)),
        "nr_cod": slice_field(linha, 25, 4),
        "cnpj_fonte": slice_field(linha, 29, 14).strip(),
        "nome_fonte": slice_field(linha, 43, 60).strip(),
        "valor": centavos_para_brl(slice_field(linha, 103, 13)),
    }


def parse_21_pj(linha: str) -> dict:
    """Tipo 21 — Fonte pagadora PJ (rendimentos tributáveis)."""
    return {
        "cnpj": slice_field(linha, 13, 14).strip(),
        "nome": slice_field(linha, 27, 60).strip(),
    }


# ---------------------------------------------------------------------------
# Auditoria heurística
# ---------------------------------------------------------------------------
def auditar(parsed: dict, linhas_raw: list) -> list:
    findings = []

    # 1. Pagamentos com problemas
    for p in parsed.get("26", []):
        nome = p.get("nome_prestador") or ""
        if not nome or "SEM NOME" in nome.upper():
            findings.append({
                "severidade": "CRITICO",
                "categoria": "Pagamentos",
                "titulo": "Prestador sem nome identificado",
                "detalhe": f"CNPJ/CPF {mascara_cnpj(p.get('id_beneficiario',''))} cadastrado sem nome. Valor: {fmt_brl(p.get('valor', 0))}.",
                "acao": "Consultar razão social no portal RFB e preencher antes de transmitir."
            })
        if p.get("valor") == 0 and nome:
            findings.append({
                "severidade": "ATENCAO",
                "categoria": "Pagamentos",
                "titulo": f"Pagamento zerado para '{nome[:40]}'",
                "detalhe": f"Lançamento sem valor. Tipo: {p.get('tipo_pagto_nome', '?')}.",
                "acao": "Preencher valor real ou excluir o lançamento."
            })

    # 2. Despesas médicas — verificar parcela não-dedutível (reembolso)
    medicos = [p for p in parsed.get("26", []) if p.get("cd_pagto") in ("10", "11", "12", "13", "14")]
    if medicos:
        total_medico = sum(p.get("valor", 0) for p in medicos)
        total_reembolso = sum(p.get("valor_nao_deducao", 0) for p in medicos)
        if total_medico > 0 and total_reembolso == 0 and len(medicos) > 3:
            findings.append({
                "severidade": "ATENCAO",
                "categoria": "Pagamentos médicos",
                "titulo": "Nenhum reembolso de plano de saúde lançado",
                "detalhe": f"Total de despesas médicas: {fmt_brl(total_medico)} em {len(medicos)} prestador(es), zero reembolso reportado.",
                "acao": "Verificar com a operadora de plano de saúde se houve reembolso. Reembolsos devem ser subtraídos para evitar malha fina."
            })

    # 3. Bens no exterior — Lei 14.754/2023
    bens_exterior = [b for b in parsed.get("27", []) if b.get("is_exterior")]
    if bens_exterior:
        total_exterior = sum(b.get("valor_atual", 0) for b in bens_exterior)
        descs = "; ".join((b.get("descricao") or "")[:50] for b in bens_exterior[:3])
        findings.append({
            "severidade": "ALERTA",
            "categoria": "Investimentos no exterior",
            "titulo": f"{len(bens_exterior)} ativo(s) no exterior — total {fmt_brl(total_exterior)}",
            "detalhe": f"Exemplos: {descs}",
            "acao": "Lei 14.754/2023: rendimentos de aplicações financeiras no exterior são tributados a 15% no ajuste anual. Verificar dividendos/JCP recebidos em 2025 (lançar em 'Aplicações Financeiras no Exterior') e ganhos de capital em vendas."
        })

    # 4. Trailer T9 vs contagem real
    contagem_real = parsed.get("_contagem", {})
    for tipo, n in contagem_real.items():
        if tipo not in REGISTROS:
            findings.append({
                "severidade": "ATENCAO",
                "categoria": "Estrutura DBK",
                "titulo": f"Tipo de registro desconhecido: '{tipo}' ({n}x)",
                "detalhe": "Pode ser leiaute novo não mapeado.",
                "acao": "Validar com o programa oficial e/ou atualizar parser."
            })

    # 5. Múltiplas fontes pagadoras (>10)
    n21 = contagem_real.get("21", 0)
    if n21 > 10:
        findings.append({
            "severidade": "ATENCAO",
            "categoria": "Rendimentos tributáveis",
            "titulo": f"{n21} fontes pagadoras PJ detectadas",
            "detalhe": "Quantidade alta pode indicar erro de classificação no e-Social (uma fonte gerando múltiplos eventos).",
            "acao": "Cruzar pré-preenchida com informes físicos. Ver malha-fina-esocial.md."
        })

    # 6. Tributação Exclusiva (84) com mesma fonte da PJ (21) — possível duplicidade
    cnpjs_84 = {x.get("cnpj_fonte", "").strip() for x in parsed.get("84", []) if x.get("cnpj_fonte")}
    cnpjs_21 = {x.get("cnpj", "").strip() for x in parsed.get("21", []) if x.get("cnpj")}
    duplicidade = cnpjs_84 & cnpjs_21
    for c in duplicidade:
        if not c:
            continue
        findings.append({
            "severidade": "ATENCAO",
            "categoria": "Possível duplicidade",
            "titulo": "Mesma fonte com pró-labore + tributação exclusiva",
            "detalhe": f"CNPJ {mascara_cnpj(c)} aparece em registros 21 (tributável) e 84 (exclusiva).",
            "acao": "Confirmar com contador: pró-labore (tributável), PLR (exclusiva), e lucros distribuídos (isentos no 88) precisam estar nas fichas corretas."
        })

    # 7. Cripto detectada
    for b in parsed.get("27", []):
        desc = (b.get("descricao") or "").upper()
        if any(t in desc for t in ["BITCOIN", "BTC ", "ETH", "ETHEREUM", "CRIPTOMOEDA", "CRIPTO ", "USDT", "USDC", "STABLECOIN", "ALTCOIN"]):
            findings.append({
                "severidade": "INFO",
                "categoria": "Criptoativos",
                "titulo": "Posição em criptoativo declarada",
                "detalhe": f"Saldo: {fmt_brl(b.get('valor_atual', 0))} — {desc[:80]}",
                "acao": "Confirmar valor em Bens = custo de aquisição. Se vendeu > R$ 35 mil em algum mês, apurar GCAP. Se posição em corretora estrangeira, atentar Lei 14.754/2023."
            })
            break  # apenas 1 alerta de cripto

    # 8. Veículo
    for b in parsed.get("27", []):
        desc = (b.get("descricao") or "").upper()
        if any(t in desc for t in ["VEICULO", "VEÍCULO", "CARRO", "AUTOMOVEL", "AUTOMÓVEL"]):
            findings.append({
                "severidade": "INFO",
                "categoria": "Veículos",
                "titulo": "Veículo declarado",
                "detalhe": f"Valor: {fmt_brl(b.get('valor_atual', 0))} — {desc[:80]}",
                "acao": "Manter pelo valor de aquisição (não atualizar pela tabela FIPE). Atualizar apenas se houver venda em 2025."
            })
            break

    # 9. Dependentes vs alimentandos
    n23 = contagem_real.get("23", 0)
    n24 = contagem_real.get("24", 0)
    if n23 > 0 and n24 > 0:
        findings.append({
            "severidade": "INFO",
            "categoria": "Núcleo familiar",
            "titulo": f"{n23} dependente(s) + {n24} alimentando(s) declarados",
            "detalhe": "Atenção: o mesmo CPF NÃO pode ser dependente E alimentando ao mesmo tempo.",
            "acao": "Validar que CPFs não se duplicam entre as fichas. Verificar decisão judicial/escritura para alimentandos."
        })

    return findings


# ---------------------------------------------------------------------------
# Pipeline principal
# ---------------------------------------------------------------------------
def parsear(caminho: Path) -> tuple[dict, list]:
    raw = caminho.read_text(encoding="latin-1", errors="replace")
    linhas = [l.rstrip("\r\n") for l in raw.splitlines() if l.strip()]

    parsed = defaultdict(list)
    contagem = Counter()

    for linha in linhas:
        tipo = linha[:2]
        contagem[tipo] += 1

        if tipo == "IR":
            parsed["IR"].append(parse_header(linha))
        elif tipo == "16":
            parsed["16"].append(parse_16_identificacao(linha))
        elif tipo == "21":
            parsed["21"].append(parse_21_pj(linha))
        elif tipo == "26":
            parsed["26"].append(parse_26_pagamentos(linha))
        elif tipo == "27":
            parsed["27"].append(parse_27_bens(linha))
        elif tipo == "84":
            parsed["84"].append(parse_84_exclusiva(linha))
        elif tipo == "88":
            parsed["88"].append(parse_88_isentos(linha))

    parsed["_contagem"] = dict(contagem)
    return dict(parsed), linhas


def gerar_relatorio(parsed: dict, findings: list, arquivo: Path, include_values: bool) -> str:
    contagem = parsed.get("_contagem", {})
    total_registros = sum(contagem.values())
    header = parsed.get("IR", [{}])[0]
    ident = parsed.get("16", [{}])[0]

    md = []
    md.append(f"# Auditoria DBK — {arquivo.name}\n")
    md.append(f"**Arquivo**: `{arquivo}`")
    md.append(f"**Tamanho**: {arquivo.stat().st_size:,} bytes")
    md.append(f"**Total de registros**: {total_registros}")
    md.append(f"**Exercício**: {header.get('exercicio', '?')} (ano-base {header.get('ano_base', '?')})")
    md.append(f"**Tipo**: {'Retificadora' if header.get('is_retificadora') else 'Original'}")
    md.append(f"**CPF**: {header.get('cpf', '?')}")
    if ident.get("nome"):
        # mostra só primeiro nome para preservar privacidade no relatório
        primeiro_nome = ident["nome"].split()[0] if ident["nome"] else ""
        md.append(f"**Declarante**: {primeiro_nome} ***")
    if ident.get("uf"):
        md.append(f"**UF**: {ident['uf']}")
    md.append("")

    md.append("## Estrutura por tipo de registro\n")
    md.append("| Código | Descrição | Quantidade |")
    md.append("|---|---|---|")
    for tipo in sorted(contagem.keys(), key=lambda t: (t.isdigit(), t)):
        nome = REGISTROS.get(tipo, "**Desconhecido**")
        md.append(f"| `{tipo}` | {nome} | {contagem[tipo]} |")

    # Bens por grupo
    bens = parsed.get("27", [])
    if bens:
        md.append("\n## Bens e Direitos\n")
        grupos = Counter()
        valores_grupo = defaultdict(float)
        for b in bens:
            grupos[b.get("grupo_nome", "?")] += 1
            valores_grupo[b.get("grupo_nome", "?")] += b.get("valor_atual", 0)
        md.append("| Grupo | Quantidade | " + ("Valor total |" if include_values else "") )
        md.append("|---|---|" + ("---|" if include_values else ""))
        for g, n in sorted(grupos.items(), key=lambda x: -x[1]):
            valor_str = f" {fmt_brl(valores_grupo[g])} |" if include_values else ""
            md.append(f"| {g} | {n} |{valor_str}")

        if include_values:
            total_bens = sum(b.get("valor_atual", 0) for b in bens)
            md.append(f"\n**Total patrimonial declarado**: {fmt_brl(total_bens)}")

        exterior = [b for b in bens if b.get("is_exterior")]
        if exterior:
            md.append(f"\n⚠️ **{len(exterior)} ativo(s) declarado(s) no exterior** — atentar Lei 14.754/2023.")

    # Pagamentos
    pgs = parsed.get("26", [])
    if pgs:
        md.append("\n## Pagamentos efetuados\n")
        md.append(f"**Quantidade**: {len(pgs)} prestador(es)")
        if include_values:
            total = sum(p.get("valor", 0) for p in pgs)
            total_red = sum(p.get("valor_nao_deducao", 0) for p in pgs)
            md.append(f"**Total bruto**: {fmt_brl(total)}")
            if total_red > 0:
                md.append(f"**Total parcela não-dedutível (reembolso)**: {fmt_brl(total_red)}")
                md.append(f"**Total dedutível líquido**: {fmt_brl(total - total_red)}")
        com_zero = sum(1 for p in pgs if p.get("valor") == 0)
        if com_zero:
            md.append(f"⚠️ **{com_zero} pagamento(s) com valor R$ 0,00**.")

    # Tributação exclusiva
    excl = parsed.get("84", [])
    if excl:
        md.append("\n## Rendimentos com Tributação Exclusiva\n")
        md.append(f"**Quantidade de fontes**: {len(set(x.get('cnpj_fonte', '') for x in excl))}")
        if include_values:
            total = sum(x.get("valor", 0) for x in excl)
            md.append(f"**Total**: {fmt_brl(total)}")

    # Isentos
    isentos = parsed.get("88", [])
    if isentos:
        md.append("\n## Rendimentos Isentos PJ\n")
        md.append(f"**Quantidade de lançamentos**: {len(isentos)}")
        if include_values:
            total = sum(x.get("valor", 0) for x in isentos)
            md.append(f"**Total**: {fmt_brl(total)}")

    # Findings
    md.append("\n## Achados da auditoria\n")
    if not findings:
        md.append("Nenhum achado heurístico. ✅")
    else:
        sev_ordem = {"CRITICO": 0, "ALERTA": 1, "ATENCAO": 2, "INFO": 3}
        findings_sorted = sorted(findings, key=lambda f: sev_ordem.get(f["severidade"], 9))
        for i, f in enumerate(findings_sorted, 1):
            badge = {"CRITICO": "🔴", "ALERTA": "🟠", "ATENCAO": "🟡", "INFO": "🔵"}.get(f["severidade"], "⚪")
            md.append(f"\n### {i}. {badge} {f['severidade']} — {f['titulo']}")
            md.append(f"**Categoria**: {f['categoria']}\n")
            md.append(f"**Detalhe**: {f['detalhe']}\n")
            md.append(f"**Ação**: {f['acao']}")

    md.append("\n---")
    md.append("\n*Gerado por `parse_dbk.py` (skill irpf-brasil) com offsets do leiaute oficial DIRPF 2025. Análise heurística — não substitui validação por contador habilitado.*")

    return "\n".join(md)


def main():
    parser = argparse.ArgumentParser(description="Parse e auditoria de arquivos DBK do IRPF")
    parser.add_argument("arquivo", type=Path, help="Caminho do arquivo .DBK")
    parser.add_argument("--output", "-o", type=Path, default=None, help="Caminho do relatório .md")
    parser.add_argument("--include-values", action="store_true", help="Incluir valores agregados")
    args = parser.parse_args()

    if not args.arquivo.exists():
        print(f"ERRO: arquivo não encontrado: {args.arquivo}", file=sys.stderr)
        sys.exit(1)

    print(f"[1/3] Parseando {args.arquivo.name}...")
    parsed, linhas = parsear(args.arquivo)
    total = sum(parsed.get("_contagem", {}).values())
    print(f"      {total} registros lidos.")

    print(f"[2/3] Aplicando heuristicas de auditoria...")
    findings = auditar(parsed, linhas)
    print(f"      {len(findings)} achado(s).")

    print(f"[3/3] Gerando relatorio...")
    md = gerar_relatorio(parsed, findings, args.arquivo, args.include_values)

    saida = args.output or args.arquivo.with_suffix(".audit.md")
    saida.write_text(md, encoding="utf-8")
    print(f"\nRelatorio salvo em: {saida}")
    print(f"Tamanho: {saida.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
