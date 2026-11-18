# FinControl — Assistente com IA (design)

_2026-11-18. Decisões do usuário (provedor, limite, privacidade) registradas na conversa de 2026-11-18; as demais (A1–A12) foram tomadas pelo agente, a pedido dele ("não me pergunte mais")._

## 1. Objetivo

Uma conversa em português simples sobre o próprio dinheiro: "quanto gastei com bebida em outubro?", "onde dá para cortar?", "estou dentro do orçamento?". O assistente consulta os dados da pessoa e responde com números reais, de forma curta.

Ele só **lê** os dados (A10). Nesta fase não cria, edita nem apaga nada.

## 2. Pedidos do usuário

- Provedor: API da Anthropic, com a chave e os créditos dele.
- Mensagens sem limite de uso normal (hoje são ele e a namorada), mas **gastando o mínimo de créditos possível**.
- Consentimento na primeira vez e uma seção nova na política de privacidade.

## 3. Decisões

- **A1. Modelo:** Claude Haiku 4.5 (`claude-haiku-4-5-20251001`), o mais barato que resolve consulta e resumo de números. A variável `AI_MODEL` permite trocar sem mudar código.
- **A2. Chamada:** `fetch` direto na Messages API (`/v1/messages`, versão `2023-06-01`), sem SDK. É uma dependência a menos, e o `fetch` é injetado nos testes.
- **A3. Ligar e desligar:** sem `ANTHROPIC_API_KEY`, o assistente fica desligado (`GET /assistant/config` devolve `enabled: false`) e a tela explica isso. **Contas demo nunca usam**, porque a demo é pública e gastaria os créditos do usuário.
- **A4. Quem pode usar:** o cadastro do app é aberto. A variável opcional `AI_ALLOWED_EMAILS` (e-mails separados por vírgula) limita o assistente a essas contas. Sem ela, qualquer conta real pode usar. Em produção, a lista leva o usuário e as contas reais que já existem.
- **A5. Consentimento:** a coluna `profiles.ai_consent_at` (migration `assistente`) é gravada por `POST /assistant/consent`. Sem ela, `POST /assistant/chat` devolve 409. A tela mostra antes o que é enviado à Anthropic.
- **A6. Conversa sem guardar no servidor:** o banco não guarda nenhuma mensagem. A conversa vive na aba (`sessionStorage`) e some ao fechar. O navegador manda o histórico a cada pergunta, até as últimas 8 mensagens e no máximo 1.000 caracteres por mensagem. Isso também limita o custo, porque o contexto não cresce sem fim.
- **A7. Ferramentas (só leitura), com resultado enxuto em reais:**
  - `resumo_periodo(de, ate)`: receitas, despesas, saldo, comparação com o período anterior e as categorias principais (até 10 de despesa e 5 de receita);
  - `buscar_lancamentos(texto?, categoria?, de?, ate?, tipo?)`: quantidade, total e até 20 lançamentos (data, descrição, valor, categoria, situação);
  - `orcamento_mes(mes?)`: limite, comprometido e situação de cada categoria com limite, além da sobra planejada;
  - `metas()`: alvo, guardado, prazo, situação e aporte mensal;
  - `saldos_e_dividas()`: saldo de cada conta, total, dívidas de cartão e empréstimo, contas vencidas e a vencer.
- **A8. Economia de créditos:**
  - o prompt de sistema é curto e leva a data de hoje, o nome e a lista de categorias da pessoa, para ela poder falar "bebida" sem que o modelo precise de outra busca;
  - `max_tokens` 700 e no máximo 4 rodadas de ferramenta por pergunta;
  - as ferramentas devolvem JSON compacto, em reais com 2 casas e sem ids;
  - o prompt caching não entra: o Haiku 4.5 só faz cache a partir de 4.096 tokens, e o prefixo aqui fica bem abaixo disso;
  - cada resposta grava no log os tokens de entrada e de saída, para acompanhar o gasto.
- **A9. Proteção contra abuso:** no máximo 30 perguntas por hora por pessoa, para impedir que uma aba em loop ou uma conta roubada esvazie os créditos. Para uso normal é ilimitado.
- **A10. Só leitura:** nenhuma ferramenta escreve. Isso evita que um pedido mal entendido altere dados.
- **A11. Erros da Anthropic:**
  - sem crédito (400 com "credit balance") → 503 "Os créditos do assistente acabaram";
  - sobrecarga ou limite (429, 529, 5xx) e falha de rede → 503 "O assistente está ocupado. Tente de novo em instantes";
  - chave inválida (401/403) → 503 genérico, com o detalhe no log.
- **A12. Tela:**
  - a página `/assistente` aparece no menu do computador (fora da barra do celular, que já tem 6 itens) e no Perfil;
  - o painel ganha um atalho "Perguntar ao assistente";
  - sugestões de perguntas prontas e resposta em texto simples (o prompt pede sem markdown; a tela respeita as quebras de linha);
  - o botão "Nova conversa" limpa o histórico.

## 4. API

| Método e rota | O que faz |
|---|---|
| `GET /assistant/config` | `{ enabled, allowed, consented }`. `allowed` é falso na demo e fora da lista |
| `POST /assistant/consent` | grava `ai_consent_at` (204) |
| `DELETE /assistant/consent` | apaga o consentimento (204) |
| `POST /assistant/chat` | `{ messages: [{ role, content }] }` → `{ reply }`. Devolve 503 se desligado, 403 se não permitido e 409 sem consentimento |

O histórico é validado: de 1 a 8 mensagens, os papéis se alternam começando por `user` e terminando em `user`, e cada mensagem tem de 1 a 1.000 caracteres.

## 5. Privacidade

Uma seção nova na política diz:
- o que é enviado (a pergunta, as mensagens da conversa e os dados financeiros que o assistente consulta para responder);
- para quem vai (Anthropic, que pela política da API não usa esses dados para treinar modelos);
- que o FinControl não guarda a conversa;
- que dá para retirar o consentimento no Perfil.

## 6. Testes

- **Domínio:** a validação do histórico, o formato de cada ferramenta e o laço de ferramentas, com um cliente falso (resposta direta, uma rodada de ferramenta, o limite de rodadas e os erros A11).
- **API:** `config`, consentimento, 403 na demo e fora da lista, 409 sem consentimento e 503 sem chave.
- **Web:** os estados da tela (desligado, sem permissão, consentimento, conversa, erro) e as sugestões.
