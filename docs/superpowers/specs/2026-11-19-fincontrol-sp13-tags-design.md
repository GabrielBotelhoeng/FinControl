# FinControl — Sub-projeto 13: Tags nos lançamentos

- **Data:** 2026-11-19
- **Status:** decisões tomadas pelo agente. É o item 6 da tabela em `docs/pesquisa-concorrentes-2026-11-18.md` (tags e subcategorias, como no Mobills, no Organizze e na Monarch), dividido em partes. Esta é a primeira: as tags no dia a dia. A segunda (sub-projeto 14) leva as tags aos relatórios, ao Excel e ao CSV. As subcategorias ficam para depois, porque mexem no orçamento e em todos os relatórios por categoria.
- **Banco:** migration nova (coluna `tags` em `transactions` e em `recurrences`). **Antes do deploy da API, aplicar no Supabase.**

## 1. Objetivo

Juntar gastos que estão em categorias diferentes. Exemplo do usuário: "estou gastando muito com bebida alcoólica". A cerveja do mercado fica em Alimentação, e a do bar fica em Lazer. Com a tag "bebida" nas duas, Lançamentos mostra tudo junto e o assistente responde quanto foi.

## 2. Decisões

| # | Decisão | Alternativas descartadas | Motivo |
|---|---|---|---|
| T1 | **Tag = rótulo livre no lançamento**, além da categoria, que continua obrigatória. Até 10 por lançamento. | Trocar a categoria por tags | A categoria sustenta o orçamento e os relatórios; a tag é um recorte a mais. |
| T2 | **Formato:** minúsculas, espaços simples e até 30 caracteres, com letras (acentos valem), números, espaço, hífen e sublinhado. O "#" do começo sai, e as repetidas viram uma. A lista fica em ordem alfabética. | Guardar como digitado | "Bebida", "#bebida" e "bebida " são a mesma tag. |
| T3 | **Banco:** coluna `tags` (lista de texto) em `transactions` e em `recurrences`, sem tabela própria. | Tabela de tags com tabela de ligação | A tag não tem outros dados. A lista dispensa junções, e a recorrência copia as tags para cada mês junto com os outros campos do modelo. |
| T4 | **Onde as tags valem:** no lançamento avulso; em todas as parcelas de uma compra no cartão; na recorrência ("só esta" muda só a ocorrência, e "esta e as próximas" muda o modelo e as próximas). As parcelas de empréstimo e de acordo nascem sem tags e podem recebê-las em Lançamentos. A importação de extrato não marca tags. | Tags só no lançamento avulso | A assinatura mensal marcada uma vez continua marcada nos meses seguintes. |
| T5 | **Filtro:** Lançamentos filtra por uma tag (`?tag=` na API e um seletor na barra de filtros). | Várias tags ao mesmo tempo | Uma tag responde à pergunta do usuário, e o seletor cabe na barra. |
| T6 | **Gestão:** a página Categorias ganha a seção "Tags", com cada tag e quantos lançamentos a usam. Dá para renomear e excluir. Renomear para o nome de outra tag junta as duas. Excluir tira a tag dos lançamentos e das recorrências; os lançamentos continuam. | Página própria | É onde a pessoa já organiza a classificação. |
| T7 | **Formulário:** o campo "Tags (opcional)" vira uma etiqueta com Enter ou vírgula, cada uma com o botão de remover, e sugere as tags já usadas. | Texto separado por vírgulas | A pessoa vê exatamente o que vai ser gravado. |
| T8 | **Linha do lançamento:** as tags aparecem depois da categoria e da conta, com "#", na mesma linha, que corta com "…" quando não cabe. | Etiquetas coloridas | Uma linha só não muda a altura da lista nem quebra a tela de 360 px. |
| T9 | **Assistente:** `buscar_lancamentos` aceita `tag` e devolve as tags de cada lançamento. | Ferramenta nova | "Quanto gastei com bebida?" é uma busca com filtro. |
| T10 | **Demo:** a tag "passeios" em todo Restaurante (Alimentação, no cartão), Cinema (Lazer, no cartão) e Lazer (Lazer, na conta corrente). | Demo sem tags | Sem nenhuma tag, a demo esconde o filtro e a seção Tags. "passeios" mostra uma tag juntando categorias e contas diferentes. |

## 3. Regras (em `packages/shared`)

- **`normalizeTag(texto)`** aplica a regra T2. **`tagsSchema`** valida a lista (até 10, cada uma pela T2), tira as repetidas e ordena.

## 4. API

- `POST /transactions` e `PATCH /transactions/:id` aceitam `tags` (T4). `TransactionDTO` ganha `tags`.
- `GET /transactions?tag=bebida` (T5).
- `GET /tags` devolve `[{ name, count }]` em ordem alfabética, sem as tags que não estão em nenhum lançamento.
- `PATCH /tags/:name` recebe `{ name }` para renomear ou juntar (T6). `DELETE /tags/:name` exclui. Uma tag que a pessoa não usa dá 404.

## 5. Limites aceitos

- As ocorrências de recorrência que já existem quando a pessoa edita "só esta" não ganham a tag nova; é o comportamento de todos os outros campos.
- "Esta e as próximas" não muda as ocorrências **já pagas** depois desta (por exemplo, um mês pago adiantado). É a regra da recorrência para todos os campos: ela não mexe no que já foi pago.
- Renomear ou excluir uma tag no mesmo instante em que o app cria ocorrências novas da recorrência (ao abrir um mês ainda sem elas) pode deixar o nome antigo nessas ocorrências. Repetir a troca resolve. Fechar essa janela pediria uma trava em toda leitura de lançamentos, e a recorrência já aceita o mesmo risco nos outros campos do modelo.
- Os relatórios ainda não somam por tag (sub-projeto 14).

## 6. Revisão final

A branch foi revisada numa sessão nova, sem o contexto de quem a escreveu, e pelo CodeRabbit. Nada crítico, e nenhum vazamento entre usuários. Corrigidos, cada um com teste:

- **Filtro sem resultado (CodeRabbit):** filtrar só por uma tag sem lançamentos no mês mostrava "Nenhum lançamento neste mês" e "Lançar agora". Agora mostra "Nada encontrado com esses filtros".
- **Seletor que sumia (CodeRabbit):** quando a tag escolhida saía do último lançamento (numa edição), o seletor sumia com o filtro ainda ligado, e a pessoa não conseguia limpá-lo. Agora ele fica, com a tag, até ela escolher "Todas as tags".
- **Barra de filtros:** com o seletor de tag, ela fica em duas colunas até caber numa linha só. Antes, com o menu do computador aberto numa tela média, a busca ficava espremida.
- **Campo de tags:** a tag inválida continua no campo para a pessoa corrigir, o aviso some quando ela edita e não se repete embaixo do erro do formulário.
- **Renomear em Categorias:** o nome inválido mostra a regra (antes vinha "Um ou mais campos são inválidos"), e "Cancelar" volta ao nome atual.
- **Demo:** ganhou a tag "passeios" (T10).

Mantidos, com o motivo na seção 5: as ocorrências já pagas depois desta em "esta e as próximas" (o CodeRabbit sugeriu mudá-las) e a corrida entre trocar a tag e criar ocorrências (o CodeRabbit sugeriu uma trava).
