# Bases legais por finalidade (LGPD)

Modelo orientativo, não é parecer jurídico; revise com advogado. Citações conferidas em `../fontes.md`.

## Como escolher
1. A finalidade existe? Defina-a em uma frase concreta (art. 6, finalidade e necessidade; art. 9 I exige finalidade específica).
2. O dado é sensível (art. 5 II)? Se sim, use **só** as hipóteses do art. 11. Se não, art. 7.
3. Prefira bases que não dependem de o titular poder dizer "não" no meio do serviço (contrato, obrigação legal, tutela da saúde). Consentimento é frágil: revogável a qualquer momento (art. 8 §5) e o ônus da prova é seu (art. 8 §2).
4. Nunca "uma base para tudo". Registre uma base por finalidade no mapa de dados.
5. Mudou a finalidade? Reavalie a base e, se houver consentimento, peça de novo (art. 8 §6 e art. 9 §2).

## Dados comuns (art. 7)
| Inciso | Hipótese | Use quando |
|---|---|---|
| I | Consentimento | marketing opcional, cookies/analytics não essenciais, depoimento com foto |
| II | Obrigação legal ou regulatória | guarda de nota fiscal, atendimento a ordem judicial |
| V | Execução de contrato ou procedimentos preliminares a pedido do titular | criar conta, entregar o plano contratado, cobrar |
| VI | Exercício regular de direitos em processo | guardar logs/contratos para defesa em disputa |
| VII | Proteção da vida ou da incolumidade física | emergência |
| VIII | Tutela da saúde, exclusivamente em procedimento por profissionais de saúde, serviços de saúde ou autoridade sanitária | ver art. 11 II f para dado sensível |
| IX | Legítimo interesse do controlador ou de terceiro, salvo prevalência de direitos do titular | segurança da conta, prevenção a abuso, métricas internas mínimas; exige teste de balanceamento escrito |
| X | Proteção do crédito | raro em app de gestão |

## Dados sensíveis (art. 11)
| Hipótese | Texto-base | Use quando |
|---|---|---|
| I | Consentimento do titular ou responsável legal, **específico e destacado**, para finalidades específicas | uso opcional de dado de saúde fora do atendimento (ex.: caso clínico em material educativo) |
| II a | Obrigação legal ou regulatória do controlador | prontuário exigido por norma |
| II d | Exercício regular de direitos, inclusive em contrato e em processo | guardar registro para defesa |
| II e | Proteção da vida ou da incolumidade física | emergência |
| II f | Tutela da saúde, exclusivamente em procedimento realizado por profissionais de saúde, serviços de saúde ou autoridade sanitária | **registro clínico do paciente pelo dentista** |
| II g | Prevenção à fraude e segurança do titular em identificação e autenticação | biometria de login (se houver) |
| II c | Estudos por órgão de pesquisa, com anonimização sempre que possível | pesquisa acadêmica (não vale para uso comercial) |

Travas do art. 11:
- §1: vale para qualquer tratamento que **revele** dado sensível (ex.: histórico de compras de um medicamento).
- §4: proibido comunicar ou compartilhar dado de saúde entre controladores com objetivo de vantagem econômica, salvo as exceções ali listadas (ver texto no Planalto antes de afirmar qualquer exceção). Na prática: não vender nem trocar dado de paciente com terceiros, nem usar para anúncios.
- §5: operadoras de planos de saúde não podem usar dados de saúde para seleção de riscos. Relevante se um dia integrar convênio.

## Exemplos para o ecossistema (app odontológico + gestão)
| Finalidade | Titular | Dado | Sensível? | Base | Observação |
|---|---|---|---|---|---|
| Criar e manter conta do dentista | dentista | nome, e-mail, CRO, senha (hash) | não | art. 7 V | CRO é dado profissional, não sensível |
| Cobrar assinatura | dentista | CPF/CNPJ, dados de pagamento via gateway | não | art. 7 V; art. 7 II (fiscal) | não guardar cartão; usar gateway |
| Registrar atendimento, odontograma, plano de tratamento | paciente | anamnese, diagnóstico, radiografias, fotos intraorais | **sim** | art. 11 II f (pelo dentista como controlador); app como operador | app só executa instruções do dentista |
| Orçamento e cobrança do paciente | paciente | nome, CPF, valores | não, mas liga a tratamento (§1) | art. 7 V (contrato dentista-paciente) | cuidado: o orçamento revela o tratamento |
| Lembrete de consulta por WhatsApp | paciente | telefone, data/hora da consulta | consulta revela atendimento de saúde (art. 11 §1) | art. 11 II f ou consentimento do paciente, a definir com o dentista | texto da mensagem: whatsapp-business-br |
| Guardar prontuário após alta | paciente | registro clínico | sim | art. 11 II a (Lei 13.787/2018, mínimo 20 anos do último registro) e II d | não apagar a pedido do paciente enquanto durar a guarda; art. 16 I |
| Usar caso clínico em aula/post | paciente | foto, caso | sim | art. 11 I, consentimento específico e destacado | Código de Ética CFO art. 14 III exige autorização do paciente ou responsável |
| Modo Estudante: gravar/transcrever aula | estudante, professor | áudio, texto | não (salvo se falar de paciente real) | art. 7 V (serviço pedido) | avisar para não gravar caso identificável |
| Analytics de uso do app | dentista | eventos, ID de dispositivo | não | art. 7 IX (mínimo) ou I (se houver SDK de publicidade) | SDK de anúncios exige consentimento |
| E-mail promocional | dentista, lead | e-mail | não | art. 7 I ou IX conforme o caso | sempre com descadastro em um clique |
| Prevenção a fraude/abuso no login | dentista | IP, dispositivo | não | art. 7 IX | documentar o balanceamento |
| IA de terceiros processando texto do app | dentista, paciente | texto que pode conter dado de saúde | pode ser | mesma base da finalidade original; transferência internacional (art. 33) | desligar por padrão para dado de paciente `[CONFIRMAR]`; vedado treinar modelo com dado de paciente sem base própria |
| Automação de redes sociais da MB Gestão | seguidores, leads | nome público, mensagens | não | art. 7 IX / I | dado público não dispensa finalidade e base |
| Responder pedido do titular, incidente, defesa | qualquer | dados do pedido | depende | art. 7 II / VI | guardar o registro |

## Consentimento: requisitos práticos (art. 8, art. 9, art. 11 I)
- Livre, informado, inequívoco, para finalidades determinadas; autorização genérica é nula (art. 8 §4).
- Por escrito em cláusula destacada ou outro meio que comprove (art. 8 caput, §1); guarde data, versão do texto e identificador.
- Caixa **não pré-marcada**, separada dos termos de uso, uma por finalidade. Recusar não pode bloquear o serviço quando o dado não é necessário a ele (art. 9 §3 trata de tratamento como condição de serviço: informe o titular dos meios de exercer direitos).
- Revogação tão fácil quanto a concessão (art. 8 §5), no próprio app.
- Menores de 18: art. 14. Criança (até 12 anos incompletos pelo ECA, art. 2º; não reconferido nesta sessão) exige consentimento específico e em destaque de um dos pais ou responsável (art. 14 §1); adolescente: melhor interesse. A ANPD publicou o Enunciado CD/ANPD nº 1/2023 sobre bases legais do art. 14: **a verificar** antes de afirmar.
- Texto-modelo curto: ver bloco "Textos de consentimento" em `politica-modelo.md`.

## Legítimo interesse: teste em 4 linhas (guarde por escrito)
1. Finalidade legítima e concreta.
2. Necessidade: o mínimo de dados, sem alternativa menos invasiva.
3. Expectativa do titular: ele esperaria isso? Há transparência?
4. Salvaguardas: opt-out, minimização, retenção curta. Dado sensível **não** usa art. 7 IX; precisa de art. 11.
