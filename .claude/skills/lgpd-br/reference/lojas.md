# Declarações de privacidade nas lojas: Google Play Data safety e Apple App Privacy

Modelo orientativo, não é parecer jurídico; revise com advogado. A loja é a segunda "política" do app: as respostas precisam bater com a política de privacidade e com o que o código realmente envia. Texto de ficha, palavras-chave e prints: skill `aso`. Código/SDKs que vazam dado: skill `security-audit`.

Regras de ouro
1. Declare o que **sai do aparelho** (app, SDKs, backend). Dado só no aparelho não entra.
2. SDK de terceiros conta como seu. Liste todos (analytics, crash, anúncios, auth, push, IA) e leia a documentação de privacidade de cada um.
3. Mudou o app (novo SDK, nova coleta)? Atualize o formulário antes de publicar a versão.
4. Dado de paciente digitado no app e enviado ao Supabase é "coletado" pelo ponto de vista da loja, mesmo que você seja só operador: declare.

## Google Play: Data safety
Fonte: central de ajuda do Play Console (ver `fontes.md`). Preenchido em Play Console > Conteúdo do app. Obrigatório para todos os apps, mesmo sem coleta.

**Declarar por tipo de dado** (14 categorias): localização; informações pessoais; informações financeiras; saúde e fitness; mensagens; fotos e vídeos; arquivos de áudio; arquivos e documentos; agenda; contatos; atividade no app; navegação na web; informações e desempenho do app; IDs de dispositivo ou outros.

Para cada tipo, informar:
- **Coletado** (enviado do aparelho) e/ou **compartilhado** (transferido a terceiro).
- **Finalidade** (padronizadas): funcionalidade do app; análises; comunicações do desenvolvedor; publicidade ou marketing; prevenção de fraude, segurança e conformidade; personalização; gerenciamento de conta.
- **Obrigatório ou opcional**: só "opcional" se todos os usuários, em qualquer dispositivo/região, podem recusar ou pular.
- **Criptografia em trânsito** (HTTPS/TLS) para todos os dados coletados.
- **Pedido de exclusão**: se o usuário pode pedir (no app, formulário ou e-mail).
- **Política de privacidade**: URL exigida para concluir o formulário.

Exceções a conferir antes de omitir: processamento só no aparelho; dado efêmero só em memória durante o pedido (ainda aparece no formulário, mas não na ficha pública; não vale para dado de anúncio ou perfil); compartilhamento por ação do usuário com expectativa razoável ou com divulgação e consentimento em destaque no app; prestador que trata só em seu nome, sob suas instruções, não é "compartilhamento".

**Exclusão de conta (Play):** apps que permitem criar conta precisam oferecer caminho **dentro do app** para excluir conta e dados associados, e um **link web** para pedir a exclusão sem reinstalar o app. Dados que a lei obrigue a manter devem estar descritos (ex.: na política). Exigência vigente desde 2024 (ver `fontes.md`).

Apps de saúde: o Play Console pode exigir formulário próprio (declaração de apps de saúde) conforme a categoria; **a verificar** no Play Console antes de publicar o Guia do Dentista.

## Apple: App Privacy ("nutrition labels")
Fonte: developer.apple.com/app-store/app-privacy-details. Respondido no App Store Connect; pode ser atualizado sem nova versão.

**Declarar**
- **Coleta**: transmitir dado para fora do aparelho de modo que você ou parceiro possa acessá-lo por mais tempo do que o necessário para atender ao pedido em tempo real. Vale mesmo se for só para funcionalidade do app.
- **Finalidades**: publicidade de terceiros; publicidade/marketing próprio; análises; personalização do produto; funcionalidade do app; outras.
- **Vinculado ao usuário?** Dado ligado à identidade por conta, dispositivo ou outros. Dado pessoal na definição das leis de privacidade conta como vinculado.
- **Rastreamento?** Cruzar dado do app com dado de terceiros para publicidade direcionada ou medição de anúncios, ou compartilhar com data broker (SDK que faça isso conta, mesmo que você não use).
- **Categorias**: Informações de contato; Saúde e fitness (inclui dados de saúde/clínicos); Informações financeiras; Localização; Informações sensíveis (origem racial/étnica, orientação sexual, gestação, deficiência, crenças, sindicato, opinião política, genéticos ou biométricos); Contatos; Conteúdo do usuário (mensagens, fotos/vídeos, áudio, suporte); Histórico de navegação e pesquisa; Identificadores; Compras; Dados de uso; Diagnósticos; Ambiente; Corpo; Outros.
- **URL da política de privacidade**: obrigatória e pública. URL de "opções de privacidade" é opcional.
- **Exclusão de conta** (Diretriz 5.1.1(v)): app com criação de conta deve permitir iniciar a exclusão dentro do app, apagar o registro e dados associados (não só desativar), informar o prazo e o que é retido por lei; exclusão só por e-mail/telefone geralmente não passa (exceção para setores muito regulados, conforme Diretriz 5.1.1(ix)); com Sign in with Apple, revogar tokens.
- Omissão opcional de um tipo de dado só se cumprir **todos** os critérios da Apple (coleta rara, opcional, sem rastreamento nem outros usos, consentimento a cada vez etc.). Na dúvida, declare.

## Mapa: dado do app para as duas lojas (Guia do Dentista, exemplo a ajustar)
| Dado | Play (tipo) | Apple (categoria) | Coletado/Compartilhado | Finalidade | Vinculado/Rastreia |
|---|---|---|---|---|---|
| Nome, e-mail do dentista | Informações pessoais | Informações de contato | coletado; compartilhado só com operadores (não conta como "compartilhado" no Play se for prestador em seu nome) | funcionalidade; gerenciamento de conta | vinculado; não rastreia |
| CRO | Informações pessoais (outros) | Outros dados | coletado | gerenciamento de conta; segurança | vinculado |
| Dados clínicos de paciente (anamnese, diagnóstico) | Saúde e fitness | Saúde e fitness | coletado | funcionalidade | vinculado; não rastreia |
| Fotos intraorais, radiografias | Fotos e vídeos; Saúde e fitness | Conteúdo do usuário (fotos); Saúde e fitness | coletado | funcionalidade | vinculado |
| Nome, telefone, CPF do paciente | Informações pessoais | Informações de contato; Identificadores se aplicável | coletado | funcionalidade | vinculado |
| Pagamento da assinatura | Informações financeiras (se você receber algo além de token) | Informações financeiras / Compras | geralmente processado pelo gateway/loja | gerenciamento de conta | vinculado |
| Áudio de aulas (Modo Estudante) | Arquivos de áudio | Conteúdo do usuário (áudio) | coletado se enviado ao servidor | funcionalidade | vinculado |
| Crash e desempenho | Informações e desempenho do app | Diagnósticos | coletado/compartilhado com SDK | análises; funcionalidade | conforme SDK |
| ID de usuário, ID de dispositivo, token de push | IDs de dispositivo ou outros | Identificadores | coletado | funcionalidade; comunicações | vinculado; rastreio só se SDK de anúncios |
| Mensagens no app | Mensagens | Conteúdo do usuário | coletado | funcionalidade | vinculado |
| Eventos de uso | Atividade no app | Dados de uso | coletado | análises | conforme SDK |

Preencha a coluna com os SDKs reais (`package.json`, plugins do Expo). Conferência final: política de privacidade, tabela acima e comportamento de rede do app devem dizer a mesma coisa.

## Checklist de publicação
- [ ] URL pública da política (e dos termos) no app, no Play Console e no App Store Connect.
- [ ] Data safety e App Privacy preenchidos a partir do mapa de dados.
- [ ] Todos os SDKs revisados; sem SDK de anúncios no app de pacientes.
- [ ] Exclusão de conta no app + link web para o Play.
- [ ] Criptografia em trânsito confirmada para tudo que sai do aparelho.
- [ ] Declaração de app de saúde conferida no Play Console `[a verificar]`.
- [ ] Classificação etária coerente com público adulto.
