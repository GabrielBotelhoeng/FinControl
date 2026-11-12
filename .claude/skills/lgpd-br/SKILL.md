---
name: lgpd-br
description: 'LGPD (Lei 13.709/2018) documents and decisions for Brazilian apps: privacy policy, terms of use, consent and notice texts, legal bases (art. 7; art. 11 for health data), data mapping and ROPA, data subject rights (art. 18), retention and deletion, international transfer, encarregado/DPO and the ANPD small-business rule, incident communication to ANPD, children''s data, and Google Play Data safety and Apple privacy labels. Triggers: "política de privacidade", "termos de uso", "LGPD", "consentimento", "dados de saúde", "base legal", "encarregado", "vazamento de dados", "Data safety", "publicar o app com dados pessoais". Not for consent screen design: use tela-bonita. Not for code security: use security-audit. Not for WhatsApp wording: use whatsapp-business-br. Not for store listing text: use aso. Orientative aid, not legal advice.'
---

# lgpd-br: documentos e decisões de LGPD para apps brasileiros

Modelo orientativo, não é parecer jurídico. Todo documento gerado termina com a nota "revisar com advogado antes de publicar". Fatos legais e prazos estão em `fontes.md` com status (verificado / a verificar). Nunca cite artigo, prazo ou número de resolução que não esteja lá.

## Quando usar / quando não usar
Usar: política de privacidade, termos de uso, textos de consentimento e aviso, escolha de base legal, mapa de dados, fluxo de direitos do titular, retenção, transferência internacional, encarregado, incidente, dados de crianças, respostas para Play/Apple.
Não usar: desenho da tela de consentimento (tela-bonita), falhas no código (security-audit), texto de mensagens de WhatsApp (whatsapp-business-br), ficha da loja (aso). Se o pedido misturar, faça só a parte jurídica e indique a skill vizinha para o resto.

## Papéis (decida primeiro, muda tudo)
- Dados da conta do dentista/usuário (e-mail, plano, uso do app): o fundador/empresa é **controlador**.
- Dados clínicos de pacientes digitados por dentistas no app: normalmente o **dentista é o controlador** (profissional liberal pessoa natural pode ser controlador, segundo o Guia ANPD de agentes de tratamento) e o app é **operador**, tratando conforme instruções dele. Isso exige contrato/termos de operador e limita o uso dos dados (sem marketing, sem treino de IA próprio, sem venda).
- Se o app decidir finalidades próprias com dados de pacientes, vira controlador também: evitar, ou documentar à parte.
- Confirme o papel com o usuário (uma pergunta, em pt-BR) quando o produto não deixar claro.

## Fluxo de trabalho
1. **Mapear dados.** Para cada app, liste: dado, titular (dentista, estudante, paciente, lead), origem, finalidade, quem acessa, onde fica (Supabase, região), operadores/SDKs, retenção, se é sensível, se envolve menores. Use a tabela do Passo 1 abaixo. Fontes: telas, schema do banco, `package.json` (SDKs), integrações (WhatsApp, e-mail, analytics).
2. **Base legal por finalidade.** Uma base por finalidade, não por dado. Dados de saúde: art. 11, não art. 7. Veja `reference/bases-legais.md`. Consentimento só quando nenhuma outra base serve; se usar, específico, destacado e revogável (art. 8, 11 I).
3. **Enquadramento do porte.** Verifique a Res. CD/ANPD 2/2022: pessoa natural, ME, EPP e startup podem ser "agente de pequeno porte", mas dado sensível junto com larga escala (ou outro critério geral) é "alto risco" e tira o benefício. Decida: encarregado indicado (recomendado para app de saúde) ou só canal de contato. Veja `reference/incidentes-e-direitos.md`.
4. **Redigir.** Política de privacidade (`politica-modelo.md`), termos (`termos-modelo.md`), avisos curtos e textos de consentimento (blocos na própria política-modelo). Preencha placeholders `{{...}}` só com fatos do passo 1; deixe `[CONFIRMAR]` onde faltar dado. Linguagem simples (art. 9 §1: informação clara; consentimento é nulo se a informação for enganosa ou abusiva).
5. **Lojas.** Converta o mapa de dados em respostas Play Data safety e Apple App Privacy (`reference/lojas.md`). Política e formulários devem dizer a mesma coisa. Inclua exclusão de conta dentro do app.
6. **Procedimentos.** Entregue o fluxo de pedidos do titular e o plano de incidente com prazos (`reference/incidentes-e-direitos.md`), mais o registro de operações (art. 37, versão simplificada permitida para pequeno porte).
7. **Ponte para outras skills.** Consentimento na tela: entregue o texto, peça o desenho à tela-bonita. Falhas técnicas encontradas no mapa: security-audit. Mensagens de WhatsApp (opt-in, descadastro): texto à whatsapp-business-br, base legal aqui.

## Passo 1: formato do mapa de dados
| Dado | Titular | Sensível? | Finalidade | Base legal (art.) | Papel (controlador/operador) | Onde fica / região | Compartilha com | Retenção | Menor? |
Uma linha por dado ou grupo de dados com a mesma finalidade.

## Formatos de saída
- Mapa de dados: a tabela acima, em Markdown, mais lista de lacunas `[CONFIRMAR]`.
- Documentos: Markdown pt-BR pronto para colar em página web do app; uma versão com data de vigência e número de versão.
- Lojas: duas tabelas (Play, Apple) com dado, coletado?, compartilhado?, finalidade, obrigatório/opcional, criptografado em trânsito.
- Resposta curta ao usuário: decisão, motivo em uma frase, próximo passo. Perguntas ao usuário sempre em pt-BR.

## Regras duras
- Dado de saúde, biometria, imagem clínica com paciente identificável = dado sensível (art. 5 II, art. 11). Fotos de boca com rosto, radiografias com nome: tratar como sensível.
- Não prometer "100% seguro", "anonimizado" sem critério, nem "não compartilhamos" se houver operador (Supabase, e-mail, IA).
- Transferência internacional: servidor fora do Brasil (ex.: Supabase em outra região, IA em nuvem) é transferência; informar na política e ter mecanismo do art. 33 (ver `incidentes-e-direitos.md`).
- Menores: o app é para adultos (profissionais e estudantes); registre idade mínima nos termos. Pacientes menores aparecem como dado digitado pelo dentista: art. 14, melhor interesse.
- Sigilo profissional (CFO): o dentista continua obrigado; o app não pode expor casos identificáveis em área pública nem em feed (Código de Ética, art. 14 III). Detalhes em `fontes.md`.
- Incidente com dado de saúde envolve "dado sensível" e "sigilo profissional": são critérios do art. 5 da Res. 15/2024 para comunicar. Comunicar em 3 dias úteis (dobro só para pequeno porte enquadrado).
- Exclusão de dados: ao fim do tratamento, eliminar, salvo exceções do art. 16; prontuário tem guarda própria (Lei 13.787/2018, mínimo 20 anos do último registro): o app deve permitir exportar e devolver ao dentista, não apagar às cegas.

## Checklist de entrega
- [ ] Papéis definidos por fluxo de dados (controlador/operador).
- [ ] Mapa de dados completo, com lacunas marcadas.
- [ ] Uma base legal por finalidade; saúde em art. 11.
- [ ] Política publicada em URL pública e linkada no app e nas lojas.
- [ ] Termos com idade mínima, regras de conteúdo e limites de responsabilidade `[advogado]`.
- [ ] Canal do titular + encarregado (ou canal de contato) divulgados.
- [ ] Fluxo de direitos (art. 18) e de incidente (Res. 15/2024) escritos.
- [ ] Transferência internacional descrita e com mecanismo.
- [ ] Play Data safety e Apple App Privacy conferem com a política.
- [ ] Exclusão de conta dentro do app e link web (Play).
- [ ] Registro de operações (art. 37) arquivado.
- [ ] Nota "modelo orientativo; revisar com advogado" presente.
