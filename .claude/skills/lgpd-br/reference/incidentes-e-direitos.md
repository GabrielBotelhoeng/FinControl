# Direitos do titular, encarregado, incidentes e transferência internacional

Modelo orientativo, não é parecer jurídico; revise com advogado. Cada prazo abaixo vem de fonte primária listada em `../fontes.md`. Onde não foi possível verificar, está marcado **a verificar**.

## 1. Encarregado (DPO)
- Regra geral: o controlador deve indicar encarregado (LGPD art. 41 caput); identidade e contato divulgados publicamente (art. 41 §1); funções incluem aceitar reclamações e comunicações dos titulares (art. 41 §2, I).
- Pequeno porte (Res. CD/ANPD 2/2022, art. 11): **não é obrigado** a indicar, mas **deve** manter canal de comunicação com o titular (art. 11 §1). Indicar encarregado conta como boa prática de governança para fins do art. 52 §1º IX (art. 11 §2).
- Quem é "pequeno porte" (art. 2 I): ME, EPP, startup, PJ de direito privado (inclusive sem fins lucrativos), **pessoa natural** e ente privado despersonalizado que trate dados com obrigações de controlador ou operador. Perde o benefício (art. 3) se: tratar dados de **alto risco**, ultrapassar o limite de receita (LC 123/2006 art. 3 II; startups LC 182/2021 art. 4 §1 I) ou integrar grupo econômico acima desses limites.
- Alto risco (art. 4): pelo menos um critério **geral** (larga escala; ou afetar significativamente direitos fundamentais) **e** um **específico** (tecnologia emergente/inovadora; vigilância de espaço público; decisão só automatizada com perfil; uso de dado sensível ou de dado de criança, adolescente ou idoso).
- Consequência prática para app de saúde: dado sensível já preenche o critério específico. Se o app tiver "larga escala" (número significativo de titulares, volume, duração, frequência e extensão geográfica, art. 4 §1) ou afetar significativamente direitos, vira alto risco e o encarregado passa a ser obrigatório. O Guia ANPD do encarregado traz exemplo de atendimento domiciliar de saúde nesse sentido. **Recomendação para o Guia do Dentista: indicar encarregado desde o início** (pode ser o próprio fundador, pessoa natural, ou terceiro).
- Divulgação (Res. CD/ANPD 18/2024, conforme o Guia ANPD de dez/2024): "identidade" = nome completo do encarregado, se pessoa natural, ou nome empresarial/título do estabelecimento, se pessoa jurídica; mais contato (só um e-mail genérico não basta). Publicar na política e em página própria.
- Mesmo sendo o dentista o controlador dos prontuários, o app deve oferecer canal ao titular (paciente) e encaminhar o pedido ao dentista.
- Pessoa física hoje, PJ depois: ao abrir CNPJ, reavaliar porte, atualizar controlador na política/termos e migrar contratos de operador.

## 2. Fluxo de pedido do titular (art. 18)
Direitos (art. 18, I a IX): confirmação do tratamento; acesso; correção; anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou ilícitos; portabilidade; eliminação dos dados tratados com consentimento (salvo art. 16); informação sobre com quem compartilhou; informação sobre a possibilidade de não consentir e consequências; revogação do consentimento.

Prazos (art. 19):
- Confirmação/acesso em formato simplificado: **imediatamente** (art. 19 I). Pequeno porte pode fornecer a declaração simplificada em **até 15 dias** (Res. 2/2022 art. 15).
- Declaração clara e completa (origem, critérios, finalidade): **até 15 dias** da requisição (art. 19 II). Pequeno porte: **prazo em dobro** (Res. 2/2022 art. 14 III), isto é, 30 dias (aritmética da regra de dobro; confirmar no uso).
- Demais pedidos do art. 18 §§ 3º e 5º: prazo em regulamentação específica; pequeno porte tem prazo em dobro (Res. 2/2022 art. 14 I). **A verificar**: se a ANPD já editou prazos gerais para esses pedidos. Enquanto isso, responder em até 15 dias é prática segura.

Passos do fluxo:
1. **Receber** pelo app (Conta > Privacidade) ou e-mail; registrar data, canal, tipo de pedido, ID do pedido.
2. **Confirmar identidade** com o mínimo necessário (login ativo ou confirmação por e-mail da conta). Não pedir documento sem necessidade.
3. **Classificar o papel**: dado da conta do usuário (somos controlador: respondemos) ou dado clínico de paciente (dentista é controlador: encaminhar ao dentista em até {{2}} dias e avisar o titular que foi encaminhado).
4. **Executar**: localizar dados em todos os sistemas do mapa (banco, storage, backups, logs, fornecedores); aplicar exceções do art. 16 (obrigação legal, guarda de prontuário) e explicar.
5. **Responder** em linguagem simples, por canal seguro, dentro do prazo; negativa precisa de motivo.
6. **Registrar** o atendimento (guardar o registro; prazo `[CONFIRMAR]`).
7. **Propagar** correção/eliminação a operadores (art. 18 §6 existe na LGPD; não reconferido nesta sessão).

Modelo de resposta (copiar e ajustar):
"Olá, {{nome}}. Recebemos em {{data}} seu pedido de {{tipo}} (protocolo {{id}}). {{Resultado: segue em anexo / foi concluído em tal data / não pudemos atender a parte X porque Y}}. Se quiser, você pode contestar escrevendo para {{contato}} ou reclamar à ANPD (gov.br/anpd)."

## 3. Segurança e incidentes

### 3.1 Base legal
LGPD art. 46 (medidas técnicas e administrativas), art. 48 (comunicar à ANPD e ao titular incidente que possa causar risco ou dano relevante; prazo definido pela ANPD, §1º). Regulamento: **Resolução CD/ANPD nº 15, de 24/04/2024** (texto conferido no art. 3 a 10).

### 3.2 O que é preciso comunicar (art. 4 e 5)
Incidente que possa acarretar **risco ou dano relevante**: afeta significativamente interesses e direitos fundamentais **e**, cumulativamente, envolve ao menos um destes: dados sensíveis; dados de crianças, adolescentes ou idosos; dados financeiros; dados de autenticação em sistemas; **dados protegidos por sigilo legal, judicial ou profissional**; dados em larga escala.
Dados de pacientes de um app odontológico quase sempre preenchem dois critérios (sensível e sigilo profissional). Trate como comunicável até avaliar o contrário.

### 3.3 Prazos
| Ação | Prazo | Fonte |
|---|---|---|
| Comunicar à ANPD | **3 dias úteis** do conhecimento de que o incidente afetou dados pessoais | Res. 15/2024 art. 6 caput e §1º |
| Complementar informações | **20 dias úteis** da comunicação, de forma fundamentada | art. 6 §3º |
| Comunicar o titular | **3 dias úteis** do mesmo marco | art. 9 caput |
| Declaração à ANPD de que o titular foi avisado | até 3 dias úteis após o fim do prazo do art. 9 caput | art. 9 §4º |
| Pequeno porte | prazos do art. 6 caput e §3º e do art. 9 caput **em dobro** | art. 6 §8º; art. 9 §6º; Res. 2/2022 art. 14 II |
| Guardar o registro do incidente | mínimo de **5 anos**, inclusive incidente não comunicado | art. 10 |
Ressalva do próprio art. 6: vale prazo de legislação específica, se houver.
Exceção à contagem em dobro no texto da Res. 2/2022 art. 14 II original (risco à integridade física ou moral ou segurança nacional): a redação foi alterada pela Res. 15/2024; confirmar a redação vigente antes de depender do dobro.

### 3.4 Como comunicar à ANPD
- Formulário eletrônico da ANPD (art. 6 §4º), via SEI!ANPD com login gov.br, processo "Comunicados de Incidentes". Feita pelo encarregado com comprovante de vínculo, ou por representante com procuração (art. 6 §5º), e os documentos vão junto no prazo (art. 6 §6º).
- Comunicação preliminar é aceita se faltarem informações, com justificativa; a complementação vem em 20 dias úteis. Fonte: página da ANPD de comunicação de incidentes.
- Conteúdo mínimo (art. 6 §2º): natureza e categoria dos dados; número de titulares (discriminando crianças, adolescentes e idosos); medidas técnicas antes e depois; riscos e impactos; motivos da demora; medidas de mitigação; datas de ocorrência e de conhecimento; dados do encarregado ou representante; identificação do controlador (e declaração de pequeno porte, se for o caso); operador; descrição e causa; total de titulares nas atividades afetadas.
- Cuidado: documentos marcados como públicos no SEI!ANPD são visíveis a qualquer pessoa; escolha o nível de acesso certo. Pedido de sigilo comercial é fundamentado (art. 7).
- Contato da ANPD para dúvidas: incidentes@anpd.gov.br (informado na página da ANPD).

### 3.5 Como comunicar o titular (art. 9)
Linguagem simples; direta e individualizada (telefone, e-mail, mensagem, carta) quando possível. Se inviável, divulgar nos meios disponíveis (site, app, redes, canais de atendimento) de forma ampla e de fácil visualização por no mínimo 3 meses (art. 9 §3º). Conteúdo (art. 9 I a VII): natureza e categoria dos dados; medidas de segurança; riscos e impactos; motivo de eventual atraso; medidas adotadas; data do conhecimento; contato/encarregado.
No caso de dado de paciente: o dentista (controlador) comunica o paciente; o app (operador) avisa o dentista **sem demora** com as informações necessárias. Contrato deve fixar prazo curto (ex.: 24 h) `[CONFIRMAR]`.

### 3.6 Plano de resposta em 8 passos
1. **Detectar e conter** (revogar chaves, desligar acesso, isolar). Falha técnica: skill `security-audit`.
2. **Registrar a hora do conhecimento** (começa a contar o prazo).
3. **Avaliar**: dados afetados, titulares, sensíveis? sigilo profissional? criptografados e ilegíveis (art. 48 §3º)?
4. **Decidir** se há risco ou dano relevante (art. 5). Dúvida em dado de saúde: comunicar.
5. **Avisar o controlador** (se somos operador) ou **comunicar ANPD e titulares** (se somos controlador) dentro do prazo.
6. **Mitigar** e orientar os titulares (recomendações práticas são boa prática, art. 9 §5º).
7. **Complementar** à ANPD em até 20 dias úteis.
8. **Registrar** no livro de incidentes (5 anos mínimo) e rever a causa.

## 4. Transferência internacional
- LGPD art. 33: permitida, entre outros casos, para país/organismo com grau de proteção adequado (I); mediante garantias do controlador, por cláusulas específicas, **cláusulas-padrão**, normas corporativas globais, selos/certificados/códigos de conduta (II); proteção da vida (IV); autorização da ANPD (V); consentimento específico e em destaque (VIII); e outros incisos listados no texto.
- **Resolução CD/ANPD nº 19/2024** (Regulamento de Transferência Internacional + cláusulas-padrão no Anexo II): cláusulas-padrão devem ser adotadas integralmente, sem alteração (art. 16). Prazo de 12 meses desde a publicação (23/08/2024) para incorporar as cláusulas-padrão em contratos: **já venceu em 23/08/2025** (data calculada a partir da publicação; confirmar). A ANPD retificou a resolução em 18/08/2025 (Cláusula 15.4).
- Obrigação de transparência (art. 17 §2): documento em português, linguagem simples, no site (pode ser parte da política, §3º), com forma, duração e finalidade da transferência, país de destino, identidade e contato do controlador, uso compartilhado e finalidade, responsabilidades e segurança, direitos do titular e direito de petição à ANPD. Pedido de cópia integral das cláusulas: resposta em 15 dias (art. 17 §1º).
- Coleta direta do titular por agente no exterior, sem exportação pelo controlador brasileiro, não é transferência internacional, segundo a ANPD (informado na página da ANPD sobre transferência).
- União Europeia/EEE: a Res. CD/ANPD nº 32/2026 teria reconhecido adequação (publicada 26/01/2026) segundo escritórios de advocacia; **a verificar no DOU/ANPD**. EUA e outros: usar cláusulas-padrão (confirmar se o fornecedor já oferece o aditivo com as cláusulas da ANPD).
- Prática para o Supabase e outros SaaS: escolher região no Brasil se existir e for viável, ou documentar país, fornecedor, mecanismo e cláusulas; listar operadores no mapa e na política. A ANPD informava que até a página consultada nenhum outro mecanismo (equivalência, cláusulas específicas, normas corporativas) tinha sido aprovado.
- Consentimento específico e em destaque (art. 33 VIII) serve, mas é frágil e revogável; use como último recurso.

## 5. Registro de operações (art. 37)
Obrigatório para controlador e operador. Pequeno porte pode manter registro **simplificado** (Res. 2/2022 art. 9; modelo fornecido pela ANPD, **a verificar** onde baixar). O mapa de dados do SKILL.md serve como base. Atualize a cada nova funcionalidade ou fornecedor.

## 6. Relatório de impacto (RIPD)
A ANPD pode pedir RIPD, inclusive após incidente (Res. 15/2024 art. 8). O regulamento específico de RIPD ainda aparece na agenda regulatória (não confirmado). Para dados sensíveis em larga escala, mantenha um RIPD simples: descrição do tratamento, riscos, medidas.

## 7. Sanções e boas práticas
Política de boas práticas e governança é critério de atenuação (art. 52 §1º IX; art. 50 permite formular regras de boas práticas). Valores e tipos de sanção: **não verificados nesta sessão**; não citar sem conferir o art. 52.
