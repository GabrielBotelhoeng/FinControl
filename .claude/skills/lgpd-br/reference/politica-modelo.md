# Modelo de Política de Privacidade (pt-BR)

> Modelo orientativo, não é parecer jurídico. Revise com advogado antes de publicar. Substitua todo `{{placeholder}}`; onde houver `[CONFIRMAR]`, falta decisão ou fato do produto. Apague os blocos que não se aplicam. Cobre o conteúdo mínimo do art. 9 da LGPD (finalidade, forma e duração, controlador, contato, compartilhamento, responsabilidades, direitos) e o aviso de transferência internacional (Res. CD/ANPD 19/2024, art. 17 §2).

Uso do modelo: uma política por app. Para o Guia do Dentista, mantenha as seções A (conta do profissional) e B (dados de pacientes como operador). Para o MB Gestão, troque B pelas finalidades de gestão e automação.

---

# Política de Privacidade do {{NOME_DO_APP}}

Versão {{N}} · Em vigor desde {{DD/MM/AAAA}} · Última revisão {{DD/MM/AAAA}}

## 1. Quem somos e como falar conosco
O {{NOME_DO_APP}} é oferecido por {{NOME_COMPLETO_OU_RAZAO_SOCIAL}}, {{CPF_OU_CNPJ}}, com endereço em {{ENDERECO_OU_CIDADE_UF}} (o "Controlador" dos dados da sua conta).
Contato sobre privacidade: {{EMAIL_PRIVACIDADE}}.
{{OPCAO_A}} Encarregado pelo tratamento de dados: {{NOME_COMPLETO_OU_EMPRESA_ENCARREGADO}}, {{EMAIL_ENCARREGADO}}.
{{OPCAO_B, se agente de pequeno porte sem encarregado}} Mantemos este canal para receber reclamações, dúvidas e pedidos sobre seus dados: {{EMAIL_PRIVACIDADE}}.

## 2. Em linguagem simples
- Usamos seus dados para abrir sua conta, fazer o app funcionar e cobrar a assinatura.
- Dados de pacientes que você registra no app são seus (você é quem decide sobre eles); nós apenas guardamos e processamos para você, seguindo suas instruções.
- Não vendemos dados. Não usamos dados de pacientes para publicidade.
- Você pode pedir acesso, correção, exclusão e outros direitos a qualquer momento (seção 9).

## 3. Quais dados tratamos, para quê e com qual base legal

### A. Dados da sua conta (profissional ou estudante)
| Dado | Para quê | Base legal |
|---|---|---|
| Nome, e-mail, senha (guardada de forma protegida), {{CRO e UF, se aplicável}} | criar e manter a conta, autenticar | execução de contrato (art. 7, V) |
| {{CPF/CNPJ}}, dados de cobrança | cobrar, emitir nota fiscal | execução de contrato (art. 7, V); obrigação legal (art. 7, II) |
| Dados de uso do app e do dispositivo (modelo, versão, erros) | segurança, correção de falhas, melhoria | legítimo interesse (art. 7, IX) / {{consentimento, se SDK de analytics não essencial}} |
| Mensagens ao suporte | atender seu pedido | execução de contrato (art. 7, V) |
| E-mails de novidades | informar sobre o app | {{consentimento (art. 7, I) / legítimo interesse (art. 7, IX)}}; você cancela quando quiser |

### B. Dados de pacientes que você registra (somente Guia do Dentista)
Dados que podem incluir identificação, anamnese, diagnóstico, odontograma, fotografias, radiografias e plano de tratamento. São dados pessoais **sensíveis** de saúde.
- Quem decide: o cirurgião-dentista usuário, que é o controlador desses dados e responde perante o paciente e o conselho profissional. Nós atuamos como operador.
- Para quê: exclusivamente prestar o serviço do app ao dentista (armazenar, exibir, gerar documentos).
- Base legal usada pelo dentista: em regra, tutela da saúde em procedimento por profissional de saúde (art. 11, II, "f"), e obrigações de guarda de prontuário (art. 11, II, "a"). O dentista deve informar seus pacientes e, quando necessário, obter o consentimento específico (art. 11, I).
- O que não fazemos: não usamos esses dados para publicidade, perfilamento, venda, treinamento de modelos de IA próprios nem os compartilhamos para vantagem econômica. `[CONFIRMAR cada afirmação com o produto real]`
- Responsabilidades do dentista: ver Termos de Uso, seção "Dados de pacientes".

### C. {{Outras finalidades do MB Gestão: automação de redes sociais, robôs de WhatsApp, etc.}}
{{Tabela no mesmo formato: dado, para quê, base legal.}}

## 4. Com quem compartilhamos
Compartilhamos apenas o necessário com operadores que nos ajudam a prestar o serviço, sob contrato:
| Quem | Para quê | Dados | País do servidor |
|---|---|---|---|
| {{Supabase}} | banco de dados e autenticação | conta, conteúdo do app | {{região escolhida, ex.: Brasil / EUA}} |
| {{Gateway de pagamento}} | cobrança | dados de pagamento | {{país}} |
| {{Serviço de e-mail}} | e-mails transacionais | e-mail, nome | {{país}} |
| {{Provedor de IA, se houver}} | {{finalidade}} | {{texto enviado}} | {{país}} |
| {{Meta/WhatsApp Business, se houver}} | mensagens ao seu pedido | telefone, texto | {{país}} |
Também podemos compartilhar com autoridades quando a lei ou uma ordem judicial exigir, e para defender nossos direitos em processo.

## 5. Transferência internacional
{{Se usar servidor ou fornecedor fora do Brasil}} Alguns dos fornecedores acima processam dados fora do Brasil, em {{PAÍSES}}. Fazemos isso com base em {{mecanismo do art. 33 da LGPD: cláusulas-padrão contratuais aprovadas pela ANPD / decisão de adequação do país de destino / outro}}. Forma e finalidade: {{descrição}}. Duração: enquanto durar a conta. Você pode pedir cópia das cláusulas pelo contato da seção 1.
{{Se não houver:}} Armazenamos e processamos os dados no Brasil.

## 6. Por quanto tempo guardamos
| Dado | Prazo |
|---|---|
| Dados da conta | enquanto a conta existir e, depois, {{prazo}} para defesa de direitos e obrigações legais `[CONFIRMAR]` |
| Dados de cobrança e fiscais | prazo exigido por lei fiscal `[CONFIRMAR com contador]` |
| Dados de pacientes | até o dentista excluir ou encerrar a conta, observando que a guarda de prontuário é do dentista (mínimo de 20 anos do último registro, Lei 13.787/2018); oferecemos exportação antes da exclusão `[CONFIRMAR]` |
| Logs de segurança | {{prazo}} |
| Backups | {{prazo}} depois da exclusão |
Depois do prazo, eliminamos ou anonimizamos, salvo as exceções do art. 16 da LGPD.

## 7. Como protegemos
{{Medidas reais, em linguagem simples: conexão criptografada, controle de acesso por conta, isolamento entre usuários (RLS), backups, registro de acessos, equipe mínima com acesso.}} Nenhum sistema é totalmente imune; se ocorrer incidente com risco relevante, avisaremos você e a ANPD nos prazos legais.

## 8. Cookies e tecnologias semelhantes
{{Se houver site/web app: liste cookies essenciais, analíticos, de marketing; peça consentimento para os não essenciais.}} O app móvel {{usa / não usa}} SDKs de publicidade.

## 9. Seus direitos (art. 18 da LGPD)
Você pode pedir: confirmação de que tratamos seus dados; acesso; correção; anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados sem respaldo na lei; portabilidade; eliminação dos dados tratados com consentimento; saber com quem compartilhamos; saber que pode não consentir e as consequências; revogar o consentimento.
Como pedir: {{no app, em Conta > Privacidade}} ou por {{EMAIL_PRIVACIDADE}}. Respondemos em até {{15 dias para confirmação/acesso completo}} `[CONFIRMAR prazo conforme reference/incidentes-e-direitos.md]`. Podemos pedir informações para confirmar que é você.
Você é paciente de um dentista que usa o app? O dentista é o responsável pelos seus dados clínicos; peça a ele. Se nos procurar, encaminhamos o pedido ao dentista.
Também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD), pelos canais em gov.br/anpd.

## 10. Excluir sua conta
Em {{Conta > Excluir conta}} no app, ou pelo link {{URL_EXCLUSAO_WEB}}. Explicamos o que é apagado, o que precisa ser mantido por lei e em quanto tempo.

## 11. Crianças e adolescentes
O {{NOME_DO_APP}} é para maiores de {{18}} anos. Não coletamos dados de menores de forma intencional. Dentistas podem registrar dados de pacientes menores; nesse caso o tratamento deve atender ao melhor interesse da criança ou do adolescente (art. 14) e, para crianças, ao consentimento de um dos pais ou responsável quando for a base usada.

## 12. Mudanças nesta política
Avisamos no app e por e-mail {{prazo, ex.: 15 dias}} antes de mudanças relevantes. Se a mudança alterar a finalidade e a base for consentimento, pediremos novo consentimento.

## 13. Lei aplicável
Lei brasileira, em especial a Lei nº 13.709/2018 (LGPD).

---

# Textos de consentimento e avisos curtos

Entregue o texto; o desenho da tela é com a skill `tela-bonita`.

**C1. Consentimento opcional de e-mail marketing (caixa desmarcada)**
"Quero receber novidades e dicas do {{NOME_DO_APP}} por e-mail. Posso cancelar quando quiser em Conta > Privacidade."

**C2. Analytics não essencial (caixa desmarcada, separada)**
"Permitir que o app colete dados de uso anônimos para melhorar o produto. Você pode mudar isso depois em Conta > Privacidade."

**C3. Uso de caso clínico em material educativo (consentimento específico, art. 11 I; texto para o dentista apresentar ao paciente)**
"Autorizo o uso de {{fotos/radiografias/descrição do caso}} do meu tratamento, {{com/sem}} minha identificação, somente para {{finalidade: aula, apresentação, publicação científica}}. Posso retirar esta autorização a qualquer momento avisando {{dentista}}. Isso não afeta meu tratamento."

**C4. Aviso ao paciente no cadastro (o dentista informa; o app pode oferecer o texto pronto)**
"{{Dentista}} registra seus dados e informações de saúde neste sistema para realizar seu atendimento, conforme as normas da odontologia. Seus dados não serão usados para propaganda. Você pode pedir acesso e cópia do seu prontuário e tirar dúvidas em {{contato}}."

**C5. Aviso para o dentista antes de salvar dado de paciente (primeiro uso)**
"Você é o responsável pelos dados dos seus pacientes. Registre só o que é necessário ao atendimento e informe seus pacientes sobre o uso deste sistema. Veja Termos de Uso, seção Dados de pacientes."

**C6. Transferência internacional com consentimento (só se não houver outro mecanismo do art. 33)**
"Concordo que meus dados sejam enviados para {{país}} para {{finalidade}}. Entendo que lá a proteção pode ser diferente. Posso retirar o consentimento quando quiser."

**C7. Modo Estudante, gravação de aula**
"Não grave nem transcreva caso clínico com paciente identificável. Se precisar, use iniciais e remova imagens que mostrem o rosto."

**C8. Rodapé padrão de documento gerado**
"Modelo orientativo gerado em {{data}}. Revisar com advogado antes de publicar."
