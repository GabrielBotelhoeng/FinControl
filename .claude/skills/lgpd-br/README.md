# lgpd-br

Skill original para Claude Code que ajuda a preparar a conformidade com a **LGPD (Lei 13.709/2018)** de apps brasileiros: política de privacidade, termos de uso, textos de consentimento, bases legais, mapa de dados, direitos do titular, incidentes, transferência internacional, encarregado e respostas para Google Play (Data safety) e Apple (App Privacy).

> **Aviso:** modelo orientativo, não é parecer jurídico. Revise todos os documentos com advogado antes de publicar.

## Para quem é
Quem publica app no Brasil, sobretudo app que guarda dados de saúde. Os exemplos usam dois apps do autor: **Guia do Dentista** (pode guardar dados clínicos de pacientes, dados sensíveis de saúde) e **MB Gestão** (gestão de empresas, automação de redes sociais, robôs de WhatsApp, backend Supabase).

## Território exclusivo
Esta skill é dona de: documentos e decisões de LGPD (política, termos, consentimento e avisos, bases legais dos arts. 7 e 11, mapa de dados/ROPA, direitos do art. 18, retenção e exclusão, transferência internacional, encarregado e regulamento de pequeno porte, comunicação de incidente à ANPD, dados de crianças e adolescentes, mapeamento das declarações das lojas).

Fica **fora**, e a `description` aponta para as vizinhas:
- Desenho da tela de consentimento: `tela-bonita`.
- Vulnerabilidades e segurança do código: `security-audit`.
- Texto das mensagens de WhatsApp: `whatsapp-business-br`.
- Texto e marketing da ficha na loja: `aso`.

Se a `description` desta skill mudar, rode de novo a checagem de sobreposição com essas vizinhas (inclua `tela-bonita`, cuja descrição cita LGPD como convenção de UI).

## Arquivos
- `SKILL.md`: fluxo de trabalho (mapear dados, base legal por finalidade, documentos, lojas, procedimentos), formatos de saída, regras duras, checklist.
- `reference/bases-legais.md`: tabela finalidade, base legal, artigo; exemplos de app odontológico.
- `reference/politica-modelo.md`: modelo de política de privacidade e textos curtos de consentimento.
- `reference/termos-modelo.md`: modelo de termos de uso.
- `reference/incidentes-e-direitos.md`: encarregado, pedidos do titular, incidente com prazos, transferência internacional, registro de operações.
- `reference/lojas.md`: mapeamento Play Data safety e Apple App Privacy.
- `fontes.md`: fontes com URL, data de acesso (2026-10-28) e status de verificação.
- `LICENSE`: Apache 2.0.

## Como instalar (quando você decidir)
Copiar a pasta `lgpd-br` para a pasta de skills do Claude Code (por exemplo `~/.claude/skills/lgpd-br`). Este rascunho **não foi instalado**.

## Limites
- Não substitui advogado nem o texto oficial no DOU.
- Itens marcados **a verificar** em `fontes.md` precisam de conferência antes de uso formal.
- Normas mudam: ANPD publica novas resoluções com frequência.

Copyright 2026 Marcos Bruno Araujo (MB Gestão). Licença Apache 2.0.
