# HANDOFF — FinControl

_Atualizado em 2026-11-25 (sub-projeto 18, SEO do site)._

## Sub-projeto 18: SEO do site (2026-11-25, branch feat/seo-site)

- **Spec e plano:** `docs/superpowers/specs/2026-11-24-fincontrol-sp18-seo-design.md` (E1–E12) e `docs/superpowers/plans/2026-11-24-fincontrol-sp18-seo.md` (T1–T6). Sem migration, sem API.
- **HTML estático (E1, E6):** no fim do `vite build`, o plugin `fincontrol-prerender` (`vite.config.ts`) chama `scripts/prerender.mjs`, que faz o build SSR de `src/prerender.tsx` e gera `dist/index.html`, `dist/privacidade/index.html` e `dist/termos/index.html` com a mesma árvore do navegador (providers e rotas, `react-dom/static` + roteador estático, sem script de hidratação embutido). Cada página tem título, descrição, canonical, `og:*` e `twitter:*` próprios, de uma tabela só (`src/lib/public-head.ts`, também usada no cliente ao navegar); o JSON-LD só na home. O plugin roda antes do PWA (`closeBundleOrder: 'post'`), então o precache leva o HTML final.
- **Casca do app e 404 (E2, E5, E7):** `dist/app.html` (vazio, `noindex`) atende a `/entrar` e as 19 rotas privadas pelos rewrites do `vercel.json`; o resto cai no `dist/404.html` (HTML puro, `noindex`, link para o início) com status 404. O teste `src/app/vercel-routes.test.ts` compara as rotas do `routes.tsx` com os rewrites. O `vite preview` imita a Vercel (`previewLikeVercel`), para o E2E e o Lighthouse locais verem o mesmo que a produção. PWA: `navigateFallback: '/app.html'`, sem fallback para `/`, `/privacidade`, `/termos` e `/api/`.
- **Sem piscar (E3):** o `public/theme-init.js` marca `data-boot="static"` só no caminho da página gerada (meta `fincontrol-prerendered`) e, na `/`, sem sessão guardada, fora do app instalado e sem retorno de login (`AUTH_RETURN_PARAMS`); senão `data-boot="app"`, e um `<style>` no `index.html` esconde o conteúdo gerado desde o primeiro quadro. O E2E confere quadro a quadro (MutationObserver + rAF) que o site não aparece com sessão, no app instalado e no retorno de login.
- **Hidratação:** o `main.tsx` ficou mínimo (CSS e a decisão); o app (`src/boot.tsx`) é importado depois da primeira pintura quando o HTML estático vale, e na hora nos outros casos (com modulepreload pelo `theme-init.js`). Antes de hidratar, o `boot.tsx` carrega o pedaço da página (`preloadable`, `src/lib/preloadable.ts`): com o pedaço em `lazy` ainda a caminho, a conferência da sessão fazia o React descartar o HTML do servidor e redesenhar do zero, sem erro no console (o E2E agora confere que os nós são os mesmos). Um toque num botão antes da hidratação fica guardado e é repetido. No build e na hidratação, o movimento reduzido e a largura não entram (`useSiteReducedMotion`, `getServerSnapshot` da seção de recursos): o HTML é um só. `data-app-ready` no `<html>` marca o app pronto (os E2E esperam por ela).
- **Animações (E4):** o que vem do HTML aparece visível; depois da hidratação, só o que está abaixo da dobra se esconde (no `useLayoutEffect`) e entra ao aparecer; o herói não anima e o saldo já vem no valor final.
- **JSON-LD e sitemap (E7, E8):** só a oferta Grátis (R$ 0); o sitemap sem a `/entrar`.
- **Login e zod (E9, E10):** `@supabase/auth-js` 2.119.0 no lugar do `@supabase/supabase-js` na web (`features/auth/client.ts`), com a mesma chave `sb-<ref>-auth-token`, os mesmos cabeçalhos e opções (teste e E2E). A entrada não carrega mais o zod: `lib/env.ts` valida sem ele, e `lib/format.ts` importa de `@fincontrol/shared/money` (novo subcaminho no `exports` do shared).
- **Medições:** Lighthouse no celular (`lighthouse@12 --form-factor=mobile`, build de produção servido localmente na porta 4180, Chromium do Playwright): **99, 99 e 99** (antes 85), acessibilidade 96, boas práticas 100, SEO 100; FCP 1,1 s, LCP 1,7 s, CLS 0. JS que o app logado carrega no painel (entrada, montagem, casca e painel, com as importações estáticas): **343,1 KB gzip contra 368,4 KB** na base cbb7ad5, medido do mesmo jeito nos dois builds.
- **Desvios da spec:** o prerender roda como plugin no `closeBundle` (que chama o `scripts/prerender.mjs`), não como passo separado depois do build, para o precache sair certo; a decisão `hydrateRoot`/`createRoot` foi do `main.tsx` para o `boot.tsx`; além do `data-prerendered-route` no `#root`, uma meta no `<head>` (o `theme-init.js` roda antes de o `#root` existir); a hidratação começa depois da primeira pintura (o site fica visível antes e responde um pouco depois; o toque fica guardado); `lib/env.ts` também saiu do zod e passou a exigir http/https.
- **Revisão (Reviewer e QA):** E1–E12 aprovados. Ajustes em `ad0f4bc`: o "2 meses grátis" com contraste suficiente (acessibilidade do Lighthouse de 96 para **100**), a casca `app.html` sem canonical e sem `og:*`/`twitter:*`, todos os toques antes da hidratação guardados e repetidos na ordem (`src/lib/held-clicks.ts`) e o teste de paridade da regex da chave de sessão (`SESSION_KEY_PATTERN`) com o `theme-init.js`.
- **CodeRabbit (PR #40):** `16415d7`: o HTML estático fica na tela se o pedaço da página não carregar, e só hidrata depois de carregar (`retrying` e o `preloadable` sem reaproveitar a promessa rejeitada); `trim` nas URLs do `lib/env.ts`; `navigateFallbackAllowlist` só com as rotas do app, derivadas do `vercel.json` (`src/app/app-route-patterns.ts`). `7ad93d9`: novas tentativas com espera crescente e limitada (1 a 30 s, uns 2 min), acordadas pelo `online`, pela volta à aba e pelo toque, sem depender da conexão mudar; se desistir, o toque num botão recarrega a página (nenhum toque fica preso); a allowlist do Workbox aceita query (`/lancamentos?novo=1`, atalho do manifest). `3b094a9`: os parâmetros das rotas offline sem aceitar `?` (`/cartoes/?x=1` recebe o 404).
- **Prévia da Vercel (DevOps, `vercel curl` autenticado):** `/privacidade` e `/termos` 200 com o HTML gerado e a cabeça própria, sem barra no fim; `/nao-existe` **404** com `noindex`; `/lancamentos` e `/entrar` 200 com a casca `noindex`; CSP e `X-Frame-Options` em todas, inclusive no 404. Toda resposta da prévia leva `X-Robots-Tag: noindex` (padrão da Vercel em prévia): conferir em produção que ele não aparece nas páginas públicas.
- **Testes:** 355 na web, 221 no shared, 385 na API, e 38 E2E com 5 pulados de propósito (novo: `e2e/tests/site-estatico.spec.ts`). Lighthouse no celular depois dos ajustes: 99, 100, 100, 100. JS do app logado: 219 KB gzip (245 KB no sub-projeto 17). CI verde no PR #40.
- **Pendências:** teste intermitente da API no CI (`debts.test.ts`, "cancelar o acordo enquanto uma parcela é paga", 422 em vez de 200/404), registrado como E-002 para o Backend; não tem relação com este sub-projeto. Fora do escopo (E12): Search Console, domínio próprio, páginas de conteúdo e o aviso de nova versão do PWA (sub-projeto 19).

## Sub-projeto 17: site de apresentação (2026-11-24, branch feat/site-apresentacao)

- **Spec e plano:** `docs/superpowers/specs/2026-11-24-fincontrol-sp17-site-apresentacao-design.md` (S1–S14) e `docs/superpowers/plans/2026-11-24-fincontrol-sp17-site-apresentacao.md` (T1–T9). Sem migration, sem API.
- **Entregue:** a `/` passa por um portão (`app/home-gate.tsx`): com sessão, o painel; sem sessão, o site (no app instalado, a entrada); as outras rotas sem sessão continuam indo para `/entrar`. O início da demo saiu da entrada para `features/auth/use-start-demo.ts`, usado pela entrada e pelo site. O site (`features/site/`) tem cabeçalho fixo, herói com o celular em CSS, a captura do painel e o cartão limão do saldo "saltando" da tela e contando, a faixa limão rolante, "Como funciona", recursos com a tela presa trocando no scroll (no celular, cartões), "No celular, como app", "Seus dados", planos com a chave Mensal/Anual, perguntas em acordeão, chamada final e rodapé. Sempre claro (`.site-root`), mesmo com o app no escuro.
- **Preços provisórios** num arquivo só (`features/site/pricing.ts`): Grátis e Completo a R$ 9,90 por mês ou R$ 99,00 por ano, com o selo "Preços de lançamento, provisórios" e "Hoje todos os recursos estão liberados de graça". Nenhuma cobrança; os botões abrem a demo. O usuário decide os valores no fim do projeto.
- **Animação:** Motion (`motion`, MIT) só no pedaço do site, com `LazyMotion` e os recursos (`domAnimation`) carregados depois do primeiro quadro; `MotionConfig reducedMotion="user"`. A faixa, os cartões flutuando e o indicador da chave são CSS (`transform`). O `h1` e o botão principal nunca começam invisíveis. Com `prefers-reduced-motion`, tudo aparece parado.
- **Imagens:** capturas reais da demo por `e2e/tests/site-capturas.spec.ts` (`SITE_CAPTURES=1 npm run test:e2e -- site-capturas`) e `npm run site:images -w @fincontrol/web` (WebP em `public/site/` e a `og-image.png`). A imagem de compartilhamento é composta em HTML no Chromium do E2E, com a Outfit de verdade. Nada de 3D nem de imagem gerada.
- **SEO:** título, descrição, canonical, Open Graph, Twitter Card e JSON-LD (`SoftwareApplication` com os preços e `FAQPage`) no `index.html`, conferidos contra `pricing.ts` e `faq-data.ts` por teste; `robots.txt` e `sitemap.xml`. As fotos do site ficam fora do cache do PWA (`globIgnores`).
- **Desvios da spec:** o componente dos planos é `plans.tsx` (não `pricing.tsx`, que colidiria com `pricing.ts` no import); a `og-image` é renderizada pelo Chromium (o `sharp` não lê woff2), e o `sharp` só comprime; na captura do assistente, só a configuração é simulada (a demo nunca libera o assistente), para mostrar a tela inicial verdadeira com as sugestões, sem resposta inventada; o indicador da chave é CSS, não `layoutId` (economiza o `domMax`).
- **Desempenho (Lighthouse no celular, critério 7):** a prévia pede o login da Vercel, então a medida foi no build de produção servido localmente (`lighthouse@12 --form-factor=mobile`, mediana de 3). Desempenho de 77 para **85** (no limite: oscila 84–85 com a carga da máquina), acessibilidade 96, boas práticas 100, SEO 100; FCP 2,6 s, LCP 3,8 s, CLS 0. O que mudou: o `public/theme-init.js` faz o preload da captura do herói e o `modulepreload` do pedaço do site só na `/` sem sessão (os nomes vêm de metas que um plugin do `vite.config.ts` escreve; nenhum script inline, a CSP não muda); `AppShell` e `LoginPage` em `lazy`; `srcset` 420/560/780 na captura; preload das fontes latinas; o portão desenha o site enquanto confere a sessão quando não há sessão guardada nem retorno de login na URL (`AUTH_RETURN_PARAMS`, a mesma lista no `theme-init.js`); as seções entram uma por quadro. Para ter folga: criar o cliente só com o `auth-js` e tirar o `zod` do caminho inicial (mexe fora do site, fica para depois).
- **Bundle:** o JS que o app logado carrega ficou em 245,2 KB gzip, 12,9 KB **menos** que a base (258,1 KB). O site tem 55,8 KB gzip num pedaço separado. O CSS global foi de 12,9 para 15,3 KB (o do site vai junto).
- **Revisão:** Reviewer (OpenCode): rolagem por âncora animada com movimento reduzido (`83cca98`) e o retorno do link de confirmação (`?token_hash=…&type=…`) desenhando o site antes do app (`df59f1c`). QA: E-001, botões escuros com o texto da cor do fundo, porque o `cn()` não faz merge de classes; virou a variante `dark` do `Button` (`86d1c7e`). CodeRabbit (PR #39): demo que falhava no seed depois do login anônimo (estado da demo numa store de módulo, `9463365`), recursos no celular que nunca revelavam (`cb59e43`), reset do erro da demo, paralaxe com movimento reduzido, imagem velha na og-image e teste de opacidade (`e74cb5f`), estado da demo limpo ao entrar com senha e início único das capturas (`6404eaa`). A 3ª rodada não teve achados.
- **Testes:** 299 na web (Testing Library) e 29 E2E, com 5 pulados de propósito (novo: `e2e/tests/site.spec.ts`, com o site a 360, 390 e 1440 px sem rolagem horizontal e com a opacidade de todos os títulos e cartões, a demo pelo herói, a `/` com sessão no painel, a chave dos planos, os botões escuros legíveis, a folga do cabeçalho e o `prefers-reduced-motion`). Shared e API sem mudança (221 e 385). CI verde no PR #39.
- **Para o usuário (opcional):** rodar `/review-animations` (a skill não roda pelo agente).

## Auditoria final (2026-11-20, branch fix/auditoria-final)

- **Relatório:** `docs/auditoria-final-2026-11-20.md` (quatro agentes: testes e E2E, valores e duplicações, banco, segurança). Nada crítico.
- **Migration:** `20261120120000_auditoria_final` (`deleted_users`, RLS e `REVOKE` na `_prisma_migrations`, sete índices de chaves estrangeiras). Aplicar em produção **antes do merge** com o comando do sub-projeto 11.
- **Corrigido:** data de pagamento de "Já está pago", mês duplicado e transação nas recorrências, crédito entre faturas, exclusão de conta (LGPD), cabeçalhos de segurança do site (CSP), limite do assistente, parcelas mínimas, calendário em 11 meses, valores com 4 casas no CSV, conta pagadora de cartão, variáveis da Vercel no bundle, XLSX.
- **Testes:** 221 no shared, 385 na API e 262 na web, além de 19 E2E. Revisão final por revisor novo e CodeRabbit (recorrência contada por período, anterior excluída, trava de perfil, exclusão que falha no Auth, crédito em fatura vazia, arredondamento do CSV, CSP).

## Sub-projeto 16: visual claro e colorido — no ar desde 2026-11-20 (PR #37)

- **Spec:** `docs/superpowers/specs/2026-11-20-fincontrol-sp16-visual-claro-design.md` (L1–L14) e o `DESIGN.md` reescrito ("Feira de manhã"). Sem migration.
- **Entregue:** o claro como padrão (o escuro continua no Perfil) com o verde-limão da marca e cores de apoio; o saldo num cartão limão e os cartões coloridos do painel; ícones de traço em quadrados da cor da categoria ou da conta (`IconTile`); a barra flutuante do celular com o "+" e a folha "Mais"; formulários em folha que sobe de baixo no celular; o valor grande e o tipo colorido no lançamento; o logo novo (o "F" com a seta de crescimento, a partir de uma referência do usuário), que também é o ícone do app; a entrada sem a arte dourada; o PDF e a planilha no verde da marca.
- **Pedidos no meio do caminho:** a pesquisa de paletas e ideias no navegador do usuário, o logo "nessa pegada" e a troca das ilustrações 3D, que ficaram com "cara de IA" (seção 6 da spec).
- **Testes:** 262 na web e 372 na API, além de 19 E2E (novo: a barra do celular a 360 px). As imagens do README foram refeitas.
- **Revisão final:** revisor novo e CodeRabbit (seção 7 da spec): a folha "Mais" que reabria no voltar e avançar, contornos no "pago" e no ícone escolhido, o foco no cartão limão e o lema da entrada no escuro.

## Sub-projeto 15: subcategorias — no ar desde 2026-11-20 (PR #36)

- **Spec:** `docs/superpowers/specs/2026-11-19-fincontrol-sp15-subcategorias-design.md` (U1–U11).
- **Migration:** `20261119233139_subcategorias` (`categories.parent_id`, sem cascata, com índice e a checagem de não ser a própria principal), **aplicada em produção antes do merge** com o comando do sub-projeto 11 (pelo usuário: o classificador bloqueia o agente). Conferido em produção pela demo (Categorias, Lançamentos, Relatórios e 360 px).
- **Entregue:** `POST /categories/:id/subcategories`; renomear (só o nome) e excluir com o destino dos lançamentos (a categoria leva as subcategorias); o filtro `categoryId` inclui as subcategorias; `rollup.ts` (`subcategoryParents` e `foldIntoParents`) soma a subcategoria na principal no orçamento (limite só na principal), no gráfico do painel, nos relatórios (com `subcategories`, o detalhe), no PDF e na planilha; "Categoria" no CSV e no Excel é a principal, com a coluna "Subcategoria"; o assistente lista e busca as subcategorias; o calendário e as maiores despesas mostram "Categoria › Subcategoria"; na web, a árvore em Categorias, o seletor (`categoryOptions`), o rótulo na linha e o detalhe no relatório; na demo, Alimentação com Mercado, Restaurante e Delivery.
- **Testes:** 216 no shared, 372 na API e 254 na web, além de 18 E2E (novo: `e2e/tests/subcategorias.spec.ts`). Revisão do CodeRabbit na seção 5 da spec.

## Sub-projeto 14: tags nos relatórios, no PDF, no CSV e no Excel — no ar desde 2026-11-19 (PR #35)

- **Spec:** `docs/superpowers/specs/2026-11-19-fincontrol-sp14-tags-relatorios-design.md` (H1–H8). Sem migration. Conferido em produção pela demo (tela, CSV, Excel, PDF e 360 px).
- **Entregue:** `expenseByTag` no relatório (despesas pagas por tag, com quantidade, participação, período anterior e variação; um lançamento com duas tags conta nas duas), o painel "Gastos por tag" em Relatórios (só com tags), a seção no PDF, a coluna "Tags" no fim do CSV e depois de "Categoria" no Excel, e a aba "Por tag" na planilha. Em Categorias, a contagem de cada tag foi para baixo do nome (a 360 px, "42 lançamentos" quebrava em duas linhas).
- **Testes:** 213 no shared, 358 na API e 247 na web, além de 17 E2E (o dos relatórios da demo confere "#passeios" e a coluna do CSV).

## Sub-projeto 13: tags nos lançamentos — no ar desde 2026-11-19 (PR #34)

- **Spec:** `docs/superpowers/specs/2026-11-19-fincontrol-sp13-tags-design.md` (T1–T9).
- **Migration:** `20261119185515_tags` (coluna `tags` em `transactions` e `recurrences`, não nula, com até 10), **aplicada em produção em 2026-11-19, antes do merge**, com o comando do sub-projeto 11 (rodado pelo usuário: o classificador bloqueia o agente). Conferido em produção pela demo a 1440 e 360 px.
- **Entregue:** tags no lançamento (normalizadas: minúsculas, sem "#", sem repetidas), nas parcelas do cartão e no modelo da recorrência; `?tag=` na lista; `GET /tags`, `PATCH /tags/:name` (renomear ou juntar) e `DELETE /tags/:name`; o campo "Tags (opcional)" no formulário, as tags na linha do lançamento, o filtro em Lançamentos e a seção Tags em Categorias; o assistente busca por tag e recebe os nomes das tags no prompt (a política de privacidade cita as tags); na demo, a tag "passeios" em Restaurante, Cinema e Lazer (T10).
- **Revisão final:** seção 6 da spec (sessão nova e CodeRabbit). Corrigidos o filtro só por tag sem resultado, o seletor que sumia com o filtro ligado, a barra de filtros espremida numa tela média, o campo de tags que apagava a tag inválida e a mensagem do renomear. Mantidos como limites (seção 5): as ocorrências já pagas depois desta em "esta e as próximas" e a corrida entre trocar a tag e criar ocorrências.
- **Testes:** 213 no shared, 357 na API e 246 na web, além de 17 E2E (novo: `e2e/tests/tags.spec.ts`).

## Sub-projeto 12: primeiros passos — no ar desde 2026-11-19 (PR #33)

- **Spec:** `docs/superpowers/specs/2026-11-19-fincontrol-sp12-primeiros-passos-design.md` (G1–G6). Sem migration.
- **Entregue:** `GET /onboarding` (cada passo feito quando existe um registro dele) e o quadro "Primeiros passos" no topo do painel, só para contas reais: cadastrar uma conta, fazer o primeiro lançamento (ou importar o extrato), definir um limite e criar uma meta, com a barra de progresso. Some sozinho com tudo feito, e "Ocultar" fica lembrado no navegador. Contas passou a aceitar `?novo=1`.
- **Testes:** 209 no shared, 346 na API e 241 na web, além de 16 E2E (novo: `e2e/tests/primeiro-acesso.spec.ts`, a 360 px).

## Sub-projeto 11: patrimônio líquido — no ar desde 2026-11-19 (PR #32)

- **Spec:** `docs/superpowers/specs/2026-11-19-fincontrol-sp11-patrimonio-design.md` (B1–B14).
- **Migration:** `20261119164547_patrimonio` (tabelas `assets` e `asset_valuations`, com RLS e a checagem do valor), **aplicada em produção em 2026-11-19, antes do merge**, com `cd apps/api && node --env-file=../../.secrets/api.production.env ../../node_modules/prisma/build/index.js migrate deploy` (funciona em PowerShell e bash). Conferido em produção pela demo a 1440 e 360 px.
- **Regra:** contas não arquivadas e sem cartão + crédito dos cartões pagos a mais + bens − dívidas (a dívida do cartão segue a R5). O valor de um bem numa data é o do registro mais recente até ela; antes do primeiro, 0.
- **Entregue:** `/assets` (bens com o histórico de valores), `GET /net-worth` (hoje e os 12 últimos meses), `netWorth` no resumo do painel, a página `/patrimonio` (menu do computador e Perfil) e a linha no painel, os bens e o patrimônio na ferramenta `saldos_e_dividas`, e na demo o "Carro" e a "Previdência privada". A política de privacidade passou a listar todos os dados guardados.
- **Reaproveitado:** `balancesAt` (saldos de várias datas numa leitura, em `reports.repository.ts`) e as peças dos gráficos em `components/ui/chart.tsx`.
- **Revisão final (revisor novo):** seção 8 da spec. Conta arquivada continua nos meses antes do arquivamento, o crédito de cartão pago a mais entra no patrimônio e a venda não pode ficar antes de um valor posterior.
- **Testes:** 209 no shared, 344 na API e 233 na web, além de 15 E2E (novo: `e2e/tests/patrimonio.spec.ts`; o de 360 px cobre `/patrimonio`).

## Atalhos no ícone do app (2026-11-19, branch feat/atalhos-pwa)

- `shortcuts` no manifest do PWA: "Novo lançamento" (`/lancamentos?novo=1`, que já abre o formulário), "Calendário de contas" e "Importar extrato".

## Sub-projeto 10: gastos que se repetem — no ar desde 2026-11-19 (PR #29)

- **Spec:** `docs/superpowers/specs/2026-11-19-fincontrol-sp10-gastos-repetidos-design.md` (S1–S4). Sem migration.
- **Entregue:** `detectRepeatedSpending` (shared), `GET /repeated` e o bloco no Resumo do mês. A importação passou a dizer "Confira a categoria" quando sugere "Outros".

## Sub-projeto 9: importar extrato — no ar desde 2026-11-19 (PR #28)

- **Spec:** `docs/superpowers/specs/2026-11-19-fincontrol-sp9-importar-extrato-design.md` (I1–I9). Sem migration.
- **Entregue:** `parseStatement` (OFX e CSV) em `packages/shared/src/statement.ts`, `POST /imports/preview` e `/imports/commit`, e a tela `/importar` (botão em Lançamentos). As categorias são sugeridas pelo histórico e por palavras-chave, e os repetidos começam desmarcados.
- **Testes:** 24 no shared, 4 na API e 3 na web; o de 360 px cobre `/importar`.

## Sub-projeto 8: calendário de contas e resumo do mês — no ar desde 2026-11-19 (PR #27)

- **Spec:** `docs/superpowers/specs/2026-11-19-fincontrol-sp8-calendario-resumo-design.md` (K1–K4, M1–M3). Sem migration.
- **Entregue:** `GET /calendar` e `/calendario` (grade do mês, totais, pagar pelo calendário, faturas); `/resumo` (frases do mês a partir do relatório e do orçamento). Menu do computador, Perfil e link no "A pagar" do painel.
- **Testes:** 2 novos na API (`calendar.test.ts`) e 6 na web; o de 360 px cobre `/calendario` e `/resumo`.

## Sub-projeto 7: plano de quitação — no ar desde 2026-11-19 (PR #26)

- **Spec:** `docs/superpowers/specs/2026-11-19-fincontrol-sp7-plano-quitacao-design.md` (Q1–Q5). Sem migration.
- **Entregue:** `/dividas/plano` (botão "Plano de quitação" em Dívidas) com avalanche, bola de neve e só o mínimo, a data de quitação, os juros, o gráfico e a ordem. Os juros e a parcela das dívidas em aberto ficam no navegador.
- **Testes:** 7 novos no shared (`payoff.test.ts`) e 5 na web; o de 360 px cobre `/dividas/plano`.

## Sub-projeto 6: dívidas com credores — no ar desde 2026-11-19 (PRs #24 e #25)

- **Spec:** `docs/superpowers/specs/2026-11-18-fincontrol-sp6-dividas-design.md` (V1–V13), com as decisões tomadas pelo agente. Fecha a seção 03 da ideia original (credores, valor original × atualizado, juros e multas, acordo, pagamentos, histórico de negociações, progresso).
- **Migrations:** `20261118221341_dividas` (tabelas `debts` e `debt_events`, coluna `transactions.debt_id`) e `20261118235500_dividas_checagens` (checagens da revisão final). **Antes do deploy da API, aplicar no Supabase.**
- **Regra central (V3):** o saldo nunca é guardado. Ele sai das âncoras (atualizações de valor e acordos) menos os pagamentos feitos depois delas (`packages/shared/src/debt.ts`). Por isso, apagar ou editar um pagamento em Lançamentos não desarruma nada.
- **Entregue:**
  - `/dividas` e `/dividas/:id`, no menu do computador, no Perfil e no link "Ver dívidas" do painel;
  - atualizar valor, registrar negociação, fechar e cancelar acordo (as parcelas viram lançamentos pendentes na categoria "Dívidas e acordos"), pagamento avulso, linha do tempo;
  - `others` no total de dívidas (painel, relatório, PDF, Excel) e as dívidas na ferramenta `saldos_e_dividas` do assistente;
  - as parcelas de acordo seguem as travas das de empréstimo (não podem ser apagadas nem mudar de valor em Lançamentos, e a conta não pode ser arquivada);
  - na demo, "Conta de luz atrasada" em aberto e "Crediário da loja de móveis" em acordo.
- **Revisão final:** seção 7 da spec (pagamento contado duas vezes, entrada do acordo, corridas).
- **Testes:** 144 no shared, 314 na API e 201 na web, além de 14 E2E (novo: `e2e/tests/dividas.spec.ts`; o de 360 px cobre `/dividas` e o detalhe, e pegou uma grade sem `grid-cols-1` que cortava os cartões).

## Assistente com IA (2026-11-18, branch feat/assistente)

- **Spec:** `docs/superpowers/specs/2026-11-18-fincontrol-assistente-ia-design.md` (A1–A12).
- **Migration:** `20261118120000_assistente` (coluna `profiles.ai_consent_at` e tabela `ai_usage`). **Antes do deploy da API, aplicar no Supabase.**
- **Variáveis na Vercel (`fincontrol-api`):**
  - `ANTHROPIC_API_KEY` (o console gera chaves `sk-ant-usr-`; as antigas são `sk-ant-api03-`): sem ela, o assistente fica desligado. **Quem cadastra é o usuário**, pelo comando `! cd apps/api && npx vercel env add ANTHROPIC_API_KEY production`, porque o agente não pode digitar chaves;
  - `AI_ALLOWED_EMAILS`: os e-mails que podem usar (`*` libera todas as contas reais; vazia, ninguém usa);
  - `AI_MODEL` (opcional): o padrão é `claude-haiku-4-5-20251001`.
- **Entregue:**
  - `/assistente` no menu do computador, no Perfil e no atalho do painel;
  - consentimento na primeira vez e seção nova na política de privacidade;
  - 5 ferramentas só de leitura (resumo do período, busca de lançamentos, orçamento, metas, saldos e dívidas);
  - conversa só na aba (`sessionStorage`), com as últimas 7 mensagens enviadas a cada pergunta;
  - limites de 100 perguntas por pessoa e 400 no total por dia, guardados em `ai_usage` com os tokens gastos, e 30 por hora contra rajadas;
  - a demo não usa o assistente.
- **Testes:** 133 em shared, 283 na API e 182 na web, além de 13 E2E (o de 360 px cobre `/assistente`).
- **No ar em 2026-11-18** (PRs #21, #22 e #23). A migration foi aplicada em produção. `AI_ALLOWED_EMAILS` libera o usuário e a Juliana.
- **Teste em produção:** feito na conta do usuário (vazia), com perguntas reais, contexto entre perguntas, "Nova conversa", retirar e aceitar o consentimento, e a tela a 360 px (num iframe).
- **Markdown:** o Haiku usa markdown mesmo com o pedido para não usar. O servidor limpa a resposta (`plainText` em `assistant.service.ts`).


## Exportação em Excel para análise (2026-11-18, branch feat/excel)

- **Spec:** `docs/superpowers/specs/2026-11-18-fincontrol-excel-analise-design.md` (E1–E10), com o escopo combinado com o usuário. Sem migration.
- **Entregue:** `GET /reports/export.xlsx` (`exceljs`) e o botão "Baixar Excel" nos relatórios. As abas são Resumo, Lançamentos (Tabela do Excel com filtros), Por categoria (variação em fórmula e "antes × agora" contra a média dos 3 meses anteriores), Mensal, Ano contra ano (até 12 meses), Onde o dinheiro vai (descrições agrupadas), Dia da semana (média diária no fim de semana e nos dias úteis), Pequenos gastos (abaixo de R$ 50), Fixos e variáveis, Dívidas e Saldos. O arquivo recalcula ao abrir (`fullCalcOnLoad`).
- **Dependência:** o `uuid` do `exceljs` foi forçado para a versão 11 (`overrides` na raiz), sem o alerta da 8.
- **E2E:** confere só a assinatura do `.xlsx` (o carregador do Playwright não lê o `exceljs`); o conteúdo é testado na API. `XLSX_OUT=<arquivo>` salva a planilha baixada da demo.
- **Pendente do Web Push:** as chaves VAPID ainda não estão na Vercel (comando no fim da conversa de 2026-11-18).


## Sub-projeto 5, Parte B: Web Push (2026-11-17, branch feat/web-push)

- **Spec:** seção "Parte B" de `docs/superpowers/specs/2026-11-17-fincontrol-sp5-notificacoes-design.md` (decisões W1–W7).
- **Migration:** `web_push` (tabela `push_subscriptions` e `notifications.pushed_at`). **Antes do deploy da API, aplicar no Supabase** pelo comando do usuário.
- **Chaves VAPID:** as de produção estão em `.secrets/vapid.env` (o contato VAPID é o endereço do site, não um e-mail). Vão para as variáveis `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` do projeto `fincontrol-api` na Vercel. Sem elas, o push fica desligado e o Perfil mostra "ainda não estão disponíveis". As chaves de teste ficam em `apps/api/.env.test`.
- **Entregue:**
  - ativação no Perfil (bloco Notificações), com aviso de teste e desligar neste aparelho; explica os casos de bloqueio, de navegador sem suporte e do iPhone sem o app instalado;
  - envio diário às 08:00 de Brasília (cron `send-push`, `0 11 * * *`): uma mensagem por pessoa com os avisos novos não lidos, cada aviso uma vez só, sem contas demo; assinatura expirada é apagada;
  - só endereços de serviços de push conhecidos (Google, Mozilla, Apple, Microsoft), contra SSRF;
  - `public/push-sw.js`, carregado pelo service worker do PWA, mostra o aviso e abre o app só no próprio site.
- **Desligar:** `POST /push/unsubscribe` com o endereço no corpo, porque o log grava as URLs.
- **Testes:** 129 em shared, 260 na API e 172 na web, além de 13 E2E. O E2E pegou o `import default` do `web-push` 4, que é ESM só com exports nomeados e que o Vitest aceitava.
- **Revisão final (revisor novo):** a lista contra SSRF resistiu a todas as tentativas de contorno. Corrigidos: sair da conta cancela a assinatura do navegador (os avisos de uma pessoa não chegam para a próxima); abrir o Perfil confirma a assinatura no servidor antes de mostrar "ligado"; no máximo 10 aparelhos por pessoa e assinatura que só falha há 30 dias é apagada; falha de envio vai para o log (status e host); chaves VAPID com formato validado; avisos reservados de forma atômica (dois envios juntos não repetem, e sem nenhum aparelho recebendo eles voltam para o próximo); clique na notificação abre janela nova se a atual não for do service worker; iPad reconhecido.
- **Teste manual em produção:** ativar no navegador e receber o aviso de teste.


## Sub-projeto 5, Parte A: central de notificações (2026-11-17, branch feat/notificacoes)

- **Spec:** `docs/superpowers/specs/2026-11-17-fincontrol-sp5-notificacoes-design.md`, com as decisões N1–N11 tomadas pelo agente. **Plano:** `docs/superpowers/plans/2026-11-17-fincontrol-sp5-notificacoes.md`.
- **Migration:** `20261117223553_notificacoes` (tabela `notifications` e a coluna `profiles.notification_prefs`), **aplicada no Supabase em 2026-11-17** pelo comando do usuário, antes do merge.
- **Entregue:**
  - o sino com os não lidos no topo de todas as telas e a página `/notificacoes`, com os avisos do mais urgente ao menos (contas vencidas e a vencer, faturas, orçamento e metas concluídas);
  - os avisos são calculados na hora, e o banco guarda só a memória (chave, quando apareceu e quando foi lido). Um aviso some sozinho quando o assunto se resolve, e a mudança de faixa ou de vencimento muda a chave, então ele volta como não lido;
  - as preferências no Perfil (tipos e antecedência de 1, 3 ou 7 dias), que mudam na hora e voltam ao estado anterior se o salvamento falhar;
  - o cron diário (`cleanup-demo`) também apaga a memória de avisos inativos há mais de 60 dias;
  - na demo, uma conta vencendo em 2 dias e a meta concluída "Notebook novo".
- **Cabeçalho do celular:** com o sino, o selo da demo desce para uma segunda linha. O teste de 360 px agora mede o cabeçalho (transbordo e sobreposição com o sino), e foi conferido que ele falha sem a correção.
- **Testes:** 128 em shared, 247 na API e 160 na web, além de 13 E2E (novo: `e2e/tests/notificacoes.spec.ts`).
- **Revisão final (revisor novo):** nada crítico. Corrigidos: o sino não atualizava ao trocar de tela (agora atualiza com o dado velho e ao voltar para a aba); "Pagar" leva ao mês do vencimento (`/lancamentos?mes=AAAA-MM`); preferências salvas pela mutação com estado otimista e ressincronização; "marcar todas" calcula uma vez só. Aceitos e registrados na spec (seção 7.1): memória de tipo desligado por mais de 60 dias e muitas contas vencidas.
- **Pendência do sub-projeto 4 (aceita, não corrigida):** se a 1ª parcela de uma compra feita nos dias 29 a 31 for excluída, a data da compra reconstruída para a dívida do cartão pode ficar 1 ou 2 dias antes. O mês fica certo, então relatório e painel não mudam.
- **Parte B (próxima):** avisos no celular e no navegador (Web Push). Precisa de chaves VAPID nas variáveis da Vercel e de um envio diário.


## Sub-projeto 4: relatórios e exportação (2026-11-17, branch feat/relatorios)

- **Spec:** `docs/superpowers/specs/2026-11-17-fincontrol-sp4-relatorios-exportacao-design.md`, com as decisões R1–R13 tomadas pelo agente. **Plano:** `docs/superpowers/plans/2026-11-17-fincontrol-sp4-relatorios-exportacao.md`.
- **Sem migration:** tudo sai das tabelas que já existem.
- **Entregue:**
  - `/relatorios` com os períodos "Mês", "Ano" e "12 meses": resumo com comparação, categorias, evolução mensal, evolução das dívidas, maiores despesas, saldos no fim do período e notas;
  - `GET /reports`, `GET /reports/export.csv` (padrão do Excel brasileiro) e `GET /reports/export.pdf` (`pdf-lib`, A4);
  - "Total de dívidas" no painel (`debts` no `/dashboard/summary`), com o link "Ver relatórios";
  - "Relatórios" no menu do computador e no Perfil. A barra do celular continua com 6 itens;
  - as pendências do sub-projeto 3: juntar categorias leva o limite (e o diálogo avisa), e o PUT de orçamento devolve o id gravado.
- **Regras de dívida:** a do cartão conta a compra parcelada inteira desde a 1ª parcela, menos pagamentos e estornos (cartão arquivado entra). A do empréstimo é o saldo devedor Price com as parcelas pagas até a data, o mesmo número da tela do empréstimo.
- **Downloads:** a web nomeia o arquivo sozinha (o CORS esconde o `Content-Disposition`) e manda o token só no cabeçalho.
- **Testes:** 120 em shared, 236 na API e 149 na web, além de 12 E2E (novo: `e2e/tests/relatorios.spec.ts`). O teste de 360 px cobre `/relatorios`.
- **Revisão final (revisor novo):** nenhum achado crítico ou alto. Os 5 baixos foram corrigidos: ano antes de 2000 dá 400 (antes, 500); parcela "já paga" adiantada conta no dia do cadastro; acentos decompostos no PDF; título de seção nunca sozinho no pé da página; eixo dos gráficos com "1,5 mil" ou reais abaixo de R$ 1 mil.
- **Cuidado ao editar no Windows:** um `﻿` literal num arquivo-fonte quebra o lint (`no-irregular-whitespace`). Use o escape.


## Sub-projeto 3: planejamento e metas (2026-11-16, branch feat/planejamento)

- **Spec:** `docs/superpowers/specs/2026-11-16-fincontrol-sp3-planejamento-metas-design.md`. As decisões P1–P10 foram tomadas pelo agente, a pedido do usuário ("não me pergunte mais"). **Plano:** `docs/superpowers/plans/2026-11-16-fincontrol-sp3-planejamento-metas.md`.
- **Entregue:**
  - limite mensal por categoria, com o comprometido (pago + a pagar) e as faixas "Dentro", "Perto do limite" e "Estourou";
  - sobra planejada e previsão de 3 meses;
  - metas com depósitos e retiradas, situação e aporte mensal, além do atalho de reserva;
  - o bloco "Orçamento do mês" no painel;
  - na demo, 4 limites (um perto, um estourado) e 2 metas.
- **Navegação:** "Planejamento" entrou no lugar de "Categorias" na barra do celular. Categorias continua no menu do computador e no Perfil.
- **Testes:** o teste de 360 px agora mede conteúdo cortado (o `overflow-x: clip` escondia). Ele achou e corrigiu um corte antigo na legenda do gráfico de categorias.
- **Testes:** 92 em shared, 218 na API e 134 na web, além de 11 E2E.
- **Antes do deploy da API:** aplicar a migration `20261116133954_planejamento` no Supabase (`npx prisma migrate deploy` pelo pooler na porta 5432).

## Sub-projeto 2, Parte A: cartões de crédito (2026-11-13, branch feat/cartoes)

- **Spec:** `docs/superpowers/specs/2026-11-12-fincontrol-sp2-credito-design.md`. **Plano executado:** `docs/superpowers/plans/2026-11-12-fincontrol-sp2-parte-a-cartoes.md` (13 tarefas, um commit por tarefa).
- **Entregue:**
  - cartão como conta `credit_card`, com limite, dia de fechamento e de vencimento, e a conta pagadora;
  - compras à vista e parceladas (até 48x), com o mês da fatura gravado na transação;
  - faturas (aberta, fechada, paga, vencida) e pagamento como transferência;
  - "A pagar" no painel com as faturas, inclusive de cartão arquivado;
  - o tile "Comprometimento de renda" (C13: ≤ 30% "Na meta", até 40% "Atenção", acima disso "Alto"), com o status seguindo o número arredondado exibido;
  - a demo com "Cartão principal", faturas pagas, uma fechada, a aberta e um notebook em 10x;
  - a página `/cartoes/:id` e o link "Ver faturas" em Contas.
- **Testes:** 60 em shared, 172 na API e 95 na web, além de 9 E2E (novo: `e2e/tests/cartao.spec.ts`). O teste de 360 px passou a cobrir a página de faturas. Lint e typecheck limpos.
- **No ar desde 2026-11-15:** PR #11 mergeado (`ebc6d58`). A migration `20261112151556_cartoes` foi aplicada no Supabase antes do merge. A produção foi conferida com Playwright pela demo, a 1440 px e a 360 px: painel, Contas e faturas sem erros e sem rolagem horizontal.
- **Revisão do CodeRabbit:** 5 correções, cada uma com teste. A regra da média do comprometimento (meses sem receita ficam fora) foi mantida e registrada na spec C13.

## Sub-projeto 2, Parte B: empréstimos (2026-11-15, branch feat/emprestimos)

- **Plano executado:** `docs/superpowers/plans/2026-11-15-fincontrol-sp2-parte-b-emprestimos.md` (11 tarefas). Os desvios D1–D6 da spec foram aceitos pelo usuário em 2026-11-15.
- **Entregue:**
  - empréstimos com taxa real (Price), custo total, juros, saldo devedor e quitação estimada;
  - parcelas restantes como lançamentos pendentes (`loanId`), na categoria nova "Empréstimos e financiamentos";
  - comparação com o banco e com a mediana do mercado (Banco Central), com fonte e período;
  - as parcelas do mês no comprometimento de renda;
  - na demo, um financiamento de veículo com 12 de 48 parcelas pagas;
  - as páginas `/emprestimos` e `/emprestimos/:id` e o item "Empréstimos" no menu. A barra do celular, agora com 6 itens, usa fonte de 10 px.
- **Testes:** 77 em shared, 198 na API e 115 na web, além de 10 E2E (novo: `e2e/tests/emprestimo.spec.ts`).
- **No ar desde 2026-11-15:** PR #12 mergeado (`4e52faa`). A migration `20261115195644_emprestimos` foi aplicada no Supabase antes do merge, e a primeira sincronização com o Banco Central gravou as 6 modalidades. A produção foi conferida pela demo, a 1440 px e a 360 px: painel (comprometimento de 16%), lista, detalhe e comparação ("7º de 39"), sem erros e sem rolagem horizontal.
- **Sincronização das taxas:** é automática, toda segunda às 07:00 UTC. Para rodar na mão: `GET /api/v1/internal/cron/sync-bank-rates` com `Authorization: Bearer <CRON_SECRET>`. Leva cerca de 1 minuto.
- **Regras vindas das revisões:**
  - parcela de empréstimo não pode ser excluída nem ter o valor mudado em Lançamentos (422);
  - a conta que paga parcelas pendentes não pode ser arquivada (422) nem excluída (409);
  - "banco do brasil" na busca acha "BCO DO BRASIL S.A.";
  - quando as parcelas somam menos que o valor recebido, a tela mostra "sem juros".
- **Leitura da API do Banco Central (2026-11-15):** só o imobiliário é mensal. Crédito pessoal, consignado e veículos vêm por semana, em `TaxasJurosDiariaPorInicioPeriodo`. As respostas gravadas para os testes ficam em `apps/api/test/fixtures/`.

## Onde estamos (sub-projeto 1)

- **Sub-projeto 1, Parte 1 (API): concluída** e na `main`.
  - 131 testes verdes: 39 em shared e 92 na API, contra Postgres real.
  - Lint e typecheck limpos.
  - Smoke test do servidor real OK.
- Spec: `docs/superpowers/specs/2026-11-11-fincontrol-fundacao-fluxo-caixa-design.md`
- Plano executado: `docs/superpowers/plans/2026-11-11-fincontrol-sp1-parte1-api.md`

## Supabase (criado em 2026-11-11)

- **Projeto:** `fincontrol` (ref `ojywswdjhjmwnfhalntl`, região sa-east-1, plano gratuito), criado pela CLI (`npx supabase`, já autenticada na conta do usuário).
- **Segredos:** em `.secrets/`, que é gitignored: senha do banco, chaves da API, `api.production.env` e `web.production.env`. O `apps/web/.env.local` já aponta para o Supabase.
- **Banco:** migrations aplicadas pelo pooler `aws-0-sa-east-1.pooler.supabase.com` (5432 para migrations, 6543 em runtime com `sslmode=require&uselibpqcompat=true`).
  - Em produção, a conexão valida a cadeia e o host contra a CA oficial do Supabase (`DATABASE_CA_CERT` na Vercel; cópia em `.secrets/supabase-prod-ca-2021.crt`). A CA vale até 2031-04-26. Com a CA, `pgConfig` tira os parâmetros SSL da URL, porque no `pg` eles sobrescreveriam a validação.
- **Auth:** login anônimo ligado e confirmação de e-mail ligada, via `supabase config push`. O `site_url` é http://localhost:5173 e deve ser trocado pela URL da Vercel no deploy. O Google OAuth está ligado desde 2026-11-11 e foi verificado: o redirect do Supabase leva ao client certo.
- **Config versionada:** `supabase/config.toml` (projeto já vinculado com `supabase link`) espelha o remoto. `echo n | npx supabase config push` mostra o diff sem aplicar nada e hoje dá "up to date" em todos os serviços. Os redirects permitidos são `localhost:5173` e `localhost:4173`. O Google está `enabled = true`. O client id e o secret ficam em `.secrets/google-oauth.env` e precisam ser exportados antes de qualquer `config push`, senão o push manda valores vazios.
- **Google Cloud:** projeto `fincontrol-514416`, OAuth client "FinControl Web (Supabase)" com o callback `https://ojywswdjhjmwnfhalntl.supabase.co/auth/v1/callback`.
  - O app está em modo **Testando**: só os usuários de teste conseguem logar (hoje, o e-mail do dono). Para abrir ao público, publique o app na tela Público-alvo.
- **Verificado de ponta a ponta:** login anônimo → `POST /demo/seed` → dashboard com dados (API local contra o Supabase real).

## Vercel (2026-11-11, branch feat/sp1-deploy)

- **Projetos:** dois, conectados ao repo do GitHub (`vercel link --repo` gera `.vercel/repo.json`, gitignored).
  - `fincontrol-web`: root `apps/web`, domínio https://fincontrol-gb.vercel.app.
  - `fincontrol-api`: root `apps/api`, domínio https://fincontrol-api-gb.vercel.app.
- **API:** a entrada é `src/index.ts` com `export default app`. O `src/server.ts` só serve para o dev local.
  - Precisa de `VERCEL_EXPERIMENTAL_BACKENDS=1`: os imports sem extensão e o `@fincontrol/shared` em TS não rodam no builder padrão.
  - O cron diário fica em `apps/api/vercel.json`.
- **Web:** o rewrite de SPA fica em `apps/web/vercel.json`.
- **Variáveis:** de produção e de preview, todas carregadas a partir de `.secrets/`. O `.vercelignore` da raiz impede o upload de `.secrets` e `.env*`.
- **Logs:** o logger HTTP registra só id, método, URL e status. Antes, gravava todos os headers, inclusive tokens da Vercel e IP/geolocalização.
- **Estado:**
  - Web em produção. Foi o primeiro deploy do projeto, e a Vercel promoveu sozinha.
  - API validada em preview: health, 401 sem token, `/me` e `/accounts` com sessão anônima real.
  - API em produção desde 2026-11-11, com deploy feito pelo usuário. Verificado no navegador: login anônimo, demo e dashboard com dados reais.
- **Supabase:** `site_url` = https://fincontrol-gb.vercel.app, que também está na lista de redirects.
- **Pendências:**
  - **CORS de previews: resolvido.** `WEB_PREVIEW_ORIGIN_PATTERN` é uma regex que o app ancora sozinho, configurada na Vercel com as URLs do time.
  - **Supabase, redirects dos previews: resolvido** (pelo dashboard, autorizado pelo usuário). O padrão é `https://fincontrol-*-gabriel-botelhos-projects.vercel.app/**`, que cobre só os previews do FinControl. O `config.toml` está espelhado e o diff deu zero.
  - **PR #3 mergeado na `main`.** O deploy de produção dos dois projetos foi verificado: health ok e CORS de preview ativo.
  - **Google:** o app está publicado ("Em produção") desde 2026-11-11, com a política em `/privacidade`. Qualquer conta Google consegue entrar.
  - Na Vercel, o Git Bash reescreve caminhos `/api/...` no `vercel curl`. Use `MSYS_NO_PATHCONV=1`.

## Próximo passo

- **Parte 2 (Web): concluída** (branch feat/sp1-web, mergeada). Inclui 42 testes, build com PWA e verificação visual sem rolagem horizontal em 360 px. A direção visual está em DESIGN.md ("Aurora no cofre", dourado, com o CoraHub como referência), e a arte de entrada foi gerada no Higgsfield.
- **Parte 3 (combinar com o usuário):**
  - Deploy na Vercel (web + API), com Supabase (Auth: e-mail, Google, anônimo) e Google OAuth.
  - E2E com Playwright: feito (`e2e/`, 7 cenários no CI, com o provedor de identidade simulado em `e2e/fake-auth.ts`).
  - README de vitrine: feito (as imagens vêm de `SCREENSHOTS=1 npm run test:e2e -- screenshots`).
- **Revisão final da Parte 2:** feita como autorrevisão. Corrigido o logout com token expirado, que deixava a sessão presa (teste RED→GREEN). As pendências menores estão na seção abaixo.

## Pendências registradas na revisão final (menores)

Resolvidas em 2026-11-11, cada uma com teste RED→GREEN:

- **Seed da demo atômico.** Roda numa transação do Postgres (`inTransaction` no container). Quem recarrega no meio não vê dados pela metade, e uma falha não trava mais a demo.
- **Busca:** `%`, `_` e `\` são tratados como texto (`escapeLike` no repositório de lançamentos).
- **"Esta e as próximas":** mover uma ocorrência paga para a data de outra paga da mesma série dá 422 com mensagem clara, antes de qualquer escrita. Antes dava 500.
- **Build sem variáveis:** mostra a tela "O FinControl não está configurado", com os nomes das variáveis, em vez da tela em branco (`checkEnv` + `ConfigErrorScreen`).
- **Corrigido antes:** criar um item enquanto a lista ainda carregava pela primeira vez não o mostrava (corrida do React Query). Agora `useFinanceMutation` cancela antes de invalidar.

- **Nova tentativa da demo:** depois de uma falha no seed, a nova tentativa reaproveita o usuário anônimo existente.
- **Cron:** registrado na Vercel (`0 6 * * *`). Testado em produção: 401 sem segredo e `{"deleted":0}` com segredo.
- **Google:** login testado de ponta a ponta pelo usuário em 2026-11-12.

## Termos e região (2026-11-12)

- Os termos de uso estão em `/termos`, com idade mínima de 18 anos. A tela de entrada avisa e liga para os termos.
- A API está fixada em São Paulo (`apps/api/vercel.json` → `regions: ["gru1"]`). Antes rodava em `iad1` (EUA), e cada consulta ao banco cruzava o continente.

## Skills de finanças (2026-11-12)

- Há 25 skills em `.claude/skills/`, escolhidas entre 696 e auditadas. O mapa de onde cada uma entra no produto está em `docs/skills-no-fincontrol.md`.
- CodeRabbit (app do GitHub) está instalado só no repositório FinControl e revisa as PRs.

## Como rodar

Ver o `README.md` (`npm run db:up`, `npm run db:migrate`, `npm run dev:api`, `npm test`).
