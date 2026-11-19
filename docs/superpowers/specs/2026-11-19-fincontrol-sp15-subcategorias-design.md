# FinControl — Sub-projeto 15: Subcategorias

- **Data:** 2026-11-19
- **Status:** decisões tomadas pelo agente. Fecha o item 6 da tabela em `docs/pesquisa-concorrentes-2026-11-18.md` ("tags e subcategorias", como no Mobills): as tags vieram nos sub-projetos 13 e 14. A subcategoria detalha uma categoria ("Alimentação › Restaurante") sem mudar o orçamento nem os gráficos.
- **Banco:** migration nova (coluna `parent_id` em `categories`). **Antes do deploy da API, aplicar no Supabase.**

## 1. Decisões

| # | Decisão | Alternativas descartadas | Motivo |
|---|---|---|---|
| U1 | **Um nível só:** categoria → subcategoria (`categories.parent_id`). Subcategoria não tem subcategoria. | Árvore de qualquer profundidade | Cobre "Alimentação › Restaurante", como no Mobills. Mais níveis complicariam filtros, orçamento e relatórios. |
| U2 | **A subcategoria herda o tipo, o ícone e a cor da categoria**; ela só tem nome. Mudar o ícone ou a cor da categoria muda as subcategorias. | Ícone e cor próprios | A cor identifica a categoria nos gráficos, e a subcategoria é um detalhe dela. |
| U3 | **Nomes únicos por tipo, contando categorias e subcategorias** (a regra de hoje). | Único só dentro da mesma categoria | A busca do assistente e as colunas do CSV e do Excel usam o nome sem ambiguidade. Uma subcategoria "Outros" não faz falta: o lançamento pode ficar na própria categoria. |
| U4 | **O lançamento escolhe a categoria ou uma subcategoria.** O seletor mostra cada categoria seguida das suas subcategorias, como "Alimentação › Restaurante". | Subcategoria obrigatória quando existir | Quem não quer detalhar não perde tempo. |
| U5 | **Tudo que soma por categoria junta as subcategorias na categoria:** o gráfico do painel, o orçamento, os relatórios, o PDF, a aba "Por categoria" e as análises da planilha, e o resumo do assistente. | Subcategoria como mais uma categoria nos totais | O orçamento e os gráficos continuam com as mesmas categorias; a subcategoria só detalha. |
| U6 | **Limite só na categoria**, e o gasto das subcategorias conta nele. | Limite por subcategoria | Um nível de limite é o que o orçamento já mostra; dois somariam o mesmo gasto duas vezes. |
| U7 | **Relatório:** embaixo de cada categoria, o detalhe por subcategoria (total, anterior e variação), na tela e no PDF, só quando alguma subcategoria teve valor no período ou no anterior. O que foi lançado direto na categoria aparece como "Sem subcategoria". | Uma seção separada por subcategoria | O detalhe fica onde a pessoa já olha. |
| U8 | **CSV e Excel:** "Categoria" é a categoria principal, e entra a coluna "Subcategoria": no CSV, no fim (depois de "Tags"); no Excel, logo depois de "Categoria". | "Categoria" com "Alimentação › Restaurante" | Com as duas colunas, o filtro e a tabela dinâmica somam por categoria sem perder o detalhe. No CSV, as colunas antigas não mudam de lugar. |
| U9 | **Excluir:** a subcategoria em uso pede o destino dos lançamentos (a própria categoria aparece primeiro). Excluir uma categoria leva junto as subcategorias, e os lançamentos de todas vão para o destino escolhido, que não pode ser uma delas. O limite da categoria segue a regra R13 a (vai para o destino, ou para a categoria do destino, quando ela não tem limite). | Proibir excluir categoria com subcategorias | Um passo só, e nenhum lançamento fica sem categoria. |
| U10 | **Assistente:** o prompt lista as subcategorias com a categoria ("Alimentação (Mercado, Restaurante)"); buscar por uma categoria inclui as subcategorias; o resultado mostra "Alimentação › Restaurante". | Ignorar subcategorias | "Quanto gastei em restaurante?" passa a ter resposta. |
| U11 | **Demo:** Alimentação ganha "Mercado", "Restaurante" e "Delivery", com os lançamentos da demo de mesmo nome nelas. | Demo sem subcategorias | Mostra o detalhe no relatório e na lista de lançamentos. |

## 2. API

- **Migration:** `categories.parent_id` (uuid, nulo nas categorias principais, chave estrangeira para `categories` sem cascata) e um índice nela. A exclusão da categoria e das subcategorias acontece num comando só.
- `CategoryDTO` ganha `parentId`.
- `POST /categories/:id/subcategories` com `{ name }` cria a subcategoria (tipo, ícone e cor da categoria). Dá 422 quando `:id` já é uma subcategoria, e 409 quando o nome existe.
- `PATCH /categories/:id`: numa subcategoria, só o nome (ícone ou cor dão 422). Na categoria, o ícone e a cor também mudam nas subcategorias.
- `DELETE /categories/:id?reassignTo=`: U9.
- `GET /transactions?categoryId=` inclui as subcategorias da categoria (é o filtro do assistente).
- Relatório: `ReportCategoryDTO` ganha `subcategories` (U7). As maiores despesas mostram "Categoria › Subcategoria". `CsvRow` ganha `subcategory`, e `category` passa a ser a principal (U8).
- Orçamento (U6), gráfico do painel e resumo do assistente (U5) somam pela categoria principal.
- Calendário: a categoria aparece como "Categoria › Subcategoria".

## 3. Web

- `categoryLabel` ("Alimentação › Restaurante") e as opções do seletor de categoria (U4), usados no formulário de lançamento, na importação de extrato, na linha do lançamento e nos próximos vencimentos do painel.
- Categorias: cada categoria com as subcategorias embaixo, "Nova subcategoria", renomear e excluir (U9).
- Relatórios: o detalhe por subcategoria embaixo da categoria (U7).

## 4. Testes

- API: criar, renomear e excluir subcategorias, com as recusas; o nome único entre níveis; ícone e cor herdados; o filtro de lançamentos com as subcategorias; o orçamento, o painel e o relatório somando na categoria, com o detalhe, o CSV, o Excel e o PDF; o assistente; a demo.
- Web: a árvore em Categorias, o seletor, o rótulo na linha e o detalhe no relatório.
- E2E: criar uma subcategoria, lançar nela e ver o rótulo na linha e o detalhe no relatório.

## 5. Fora deste sub-projeto

- Mover uma subcategoria para outra categoria, ou transformar uma categoria em subcategoria (dá para criar a subcategoria e excluir a categoria antiga levando os lançamentos para ela).
- Subcategorias padrão nas contas novas e limite por subcategoria.
