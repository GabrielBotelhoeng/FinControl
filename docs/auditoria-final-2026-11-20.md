# Auditoria final antes do site — 2026-11-20

Pedido do usuário: antes de começar o site de apresentação, uma rodada final de testes com quatro agentes independentes (somente leitura; só o primeiro rodou testes). Branch das correções: `fix/auditoria-final`.

## Resultado geral

- **Nada crítico.** Nenhum acesso a dado de outro usuário (IDOR), nenhum segredo no bundle publicado nem no histórico do git (258 commits), CORS fechado, todas as rotas sem token dão 401, todas as entradas da API passam pelo zod.
- **Testes:** lint, typecheck, 216 + 372 + 262 testes e 19 E2E verdes antes das correções.
- **Produção (demo, 1440 e 360 px):** lançar, pagar, editar, excluir e transferir mudaram o saldo exatamente pelo valor em centavos, sem nada duplicado e sem erro no console.

## Achados e o que foi feito

| # | Severidade | Achado | Feito |
|---|---|---|---|
| A1 | Alta | "Já está pago" gravava a data de pagamento como hoje: um gasto antigo contava no mês errado no painel, relatórios e saldo. Editar a data de um pago deixava o pagamento no mês antigo. | Sem data de pagamento, a criação usa o vencimento (limitado a hoje). Mudar o vencimento de um pago leva junto o pagamento que caiu no próprio vencimento (nunca para o futuro). |
| M1 | Média | Mudar a data de uma recorrência em "esta e as próximas" duplicava um mês já pago adiantado; mover para antes da ocorrência anterior deixava dois lançamentos no mesmo mês. | A paga levada para a série nova ocupa a vaga dela (pulo na série nova); mover para antes da ocorrência anterior dá 422. |
| M1b | Média | Editar ou excluir "desta em diante" gravava em vários passos sem transação: uma falha no meio deixava duas séries ativas. | `createSeries`, `updateFuture`, `removeFuture` e `removeSingle` rodam numa transação, com a série travada (`FOR UPDATE`). |
| M3 | Média | Fatura paga a mais não abatia a seguinte em "A pagar", no calendário nem no próximo vencimento. | O crédito passa de uma fatura para a seguinte em `invoiceTotalsByMonth`, a fonte única de todas as telas. |
| S1 | Média | A tabela `_prisma_migrations` (sem RLS) podia ser lida pela API REST do Supabase com a chave pública. | Migration `20261120120000_auditoria_final`: RLS e `REVOKE` de `anon` e `authenticated`. |
| LGPD | Média | Depois de excluir a conta, uma aba aberta com o token ainda válido recriava o perfil e as 15 categorias. | Tabela `deleted_users` (só o id), gravada na mesma transação da exclusão; o token antigo recebe 401. |
| S2 | Média | O site não enviava cabeçalhos de segurança (CSP, nosniff, moldura, referrer). | `apps/web/vercel.json` com CSP restrita, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` e `Permissions-Policy`. O script do tema saiu do `index.html` para `public/theme-init.js`. |
| S3 | Média-baixa | Perguntas simultâneas ao assistente passavam todas pelo limite do dia. | A vaga é reservada antes da chamada à IA, numa transação com trava do dia. |
| B1 | Baixa | Parcelar um valor menor que o número de parcelas dava erro 500. | 422 com mensagem. |
| B3 | Baixa | O calendário ia 12 meses à frente, mas as recorrências só existem até hoje + 366 dias. | 11 meses, como o orçamento (API e web). |
| B5 | Baixa | "1234.5678" num CSV virava R$ 12.345.678,00. | 4 ou mais casas são decimais, arredondadas para centavos. |
| B7 | Baixa | Excluir a conta pagadora de um cartão deixava o cartão sem pagadora. | 409 com mensagem. |
| S6 | Baixa | O bundle publicava as variáveis de sistema da Vercel (commit, autor, ids). | `env.ts` lê só as três variáveis do app. |
| S7 | Baixa | Texto de terceiros num extrato importado podia tentar mandar no assistente. | O prompt diz que o que vem das ferramentas é dado, nunca instrução (as ferramentas já só leem). |
| S8 | Baixa | O XLSX não protegia tab e CR no começo do texto, como o CSV. | Mesmo conjunto do CSV. |
| — | Baixa | Índices faltando em chaves estrangeiras. | Sete índices na mesma migration. |
| — | Baixa | `npx eslint .` falhava por causa das skills instaladas (`.agents/`, fora do git). | Pastas ignoradas no lint. |

## Ficaram de fora (limites aceitos, com o motivo)

- **Saldo total × evolução no mês com compra parcelada (M2):** o saldo total conta a dívida inteira do cartão (é o que se deve hoje); a evolução conta só a parcela do mês. Os dois números respondem perguntas diferentes.
- **Importação confirmada duas vezes (B4 / banco 5):** o botão fica travado enquanto envia; a prévia já marca as repetidas. Fica para quando houver relato.
- **Estorno no cartão (B2):** é recurso novo, não correção.
- **Nomes únicos e regras só na API, chaves estrangeiras compostas (banco 4, 6, 10):** defesa extra; hoje a API confere tudo. Um índice único em `lower(name)` pode falhar com dados já existentes.
- **Rate limit em memória por instância:** o teto diário do assistente, agora atômico, limita o gasto.
- **No painel do Supabase (só o usuário):** captcha no login anônimo (demo), senha mínima de 8 e proteção contra senhas vazadas.
- **Chave VAPID de teste no git:** é só de teste; conferir que a de produção é outra.
- **`npm audit`:** 3 altas no `effect` (vem do CLI do Prisma, não roda com entrada de usuário) e 12 moderadas em ferramentas de build.
