# Sub-projeto 19: atualização do PWA — design

_2026-11-25, branch `feat/pwa-atualizacao` (base `main` f595ea3). Tarefa T-006. Sem API, sem banco, sem migration._

## Problema

Quem já visitou o app fica com o service worker antigo: o novo é instalado, mas fica em `waiting` até a pessoa fechar
todas as abas. A causa está no `vite.config.ts`: com `injectRegister: 'script-defer'`, o `vite-plugin-pwa` não liga o
`skipWaiting`/`clientsClaim` do Workbox (ele só faz isso com `injectRegister: 'auto'`), e o `registerSW.js` gerado só
registra o service worker, sem mandar `SKIP_WAITING`. Depois de um deploy, a página aberta ainda pode pedir pedaços
(`/assets/*-hash.js`) que já não existem na Vercel, e a troca de tela quebra.

## Decisões

| # | Decisão | Motivo |
|---|---|---|
| A1 | `workbox.skipWaiting: true` e `clientsClaim: true` no `vite.config.ts`, mantendo o `registerSW.js` em arquivo (`script-defer`). | É a causa direta: o SW novo assume sozinho, sem esperar as abas fecharem. Manter o `registerSW.js` em arquivo deixa a CSP sem script embutido e o registro fora da primeira pintura (Lighthouse); o `virtual:pwa-register` levaria o registro para dentro do pacote do app e não traria nada que falte aqui. |
| A2 | A página aberta **não** recarrega sozinha. Quando o SW novo assume (`controllerchange`), aparece um aviso discreto do sonner (o mesmo `Toaster` do app): "Nova versão disponível", com o botão **Atualizar**, que recarrega a página, e um botão para fechar. Vale no app e no site público (a `/` sem sessão também passa pelos providers). Não aparece na primeira instalação: o primeiro `controllerchange` de uma página que abriu sem SW (e sem registro ativo) é só o SW novo assumindo, não uma versão nova. | Recarregar sozinho perderia um formulário aberto (um lançamento pela metade). A escolha fica com a pessoa, que atualiza quando terminar. O registro ativo cobre a recarga forçada (Shift+F5), em que a página abre sem controlador mas já tem SW. |
| A3 | Procurar atualização (`registration.update()`) ao voltar para a aba (`visibilitychange` para visível) e a cada 60 min. | O navegador só confere o `sw.js` ao navegar; num PWA aberto o dia todo, a versão nova demoraria. A volta à aba é o momento natural, e os 60 min cobrem a aba que fica sempre à frente. Sem conexão, a falha é ignorada. |
| A4 | Proteção dos pedaços antigos: o evento `vite:preloadError` (o Vite o dispara quando um `import()` dinâmico ou um preload falha) mostra o **mesmo aviso**. Se o que falhou foi o próprio boot do app (nada montado ainda, só o HTML estático ou a tela vazia), a página recarrega **uma vez**, com trava no `sessionStorage` (`fincontrol-recarga-versao`), apagada quando o app monta. As rotas ganham uma tela de erro em português (no lugar da tela padrão do React Router, em inglês), com o botão **Atualizar**. | Com o app montado, recarregar sozinho poderia perder dados (A2); o aviso resolve sem risco. Sem o app montado, não há o que perder, e a recarga busca o HTML e os pedaços certos; a trava impede o laço se a falha continuar (servidor fora do ar). A tela de erro evita que a pessoa fique numa tela em inglês sem saída. |
| A5 | A sessão (`sb-<ref>-auth-token` no `localStorage`) e os dados não são tocados: nada de `caches.delete`, `unregister` ou limpar armazenamento. A atualização é só `location.reload()`. | Ninguém pode ser deslogado por causa de um deploy. O Workbox já apaga o precache antigo (`cleanupOutdatedCaches`). |
| A6 | O aviso tem `role="status"` (lido sem interromper), não puxa o foco (o formulário continua com o cursor onde estava), os botões têm o anel de foco do `DESIGN.md` e são alcançáveis pelo teclado (Alt+T leva aos avisos do sonner; o rótulo da região passa para "Avisos"). Com `prefers-reduced-motion`, o sonner não anima (CSS dele). | Um aviso que rouba o foco atrapalha quem está digitando e quem usa leitor de tela; o `status` anuncia sem interromper. |

## Fora do escopo

API, banco, push (o `push-sw.js` continua igual), mudanças no precache além das duas opções do Workbox.

## Testes

- Unitários (`apps/web`): o observador de atualização (primeira instalação sem aviso, `controllerchange` com aviso,
  recarga forçada, `visibilitychange` e os 60 min chamando `update()`, `vite:preloadError` com aviso, a trava da
  recarga única), o aviso (texto, `role="status"`, Atualizar recarrega, fechar, foco não muda) e a tela de erro das rotas.
- E2E (`e2e/tests/pwa-atualizacao.spec.ts`, com o service worker liberado só nele): na `/` sem sessão, o SW registra e
  controla sem aviso; o `sw.js` servido ganha outra revisão e a volta à aba dispara o `update()`: o aviso aparece. Na
  `/entrar`, com o e-mail digitado, o aviso aparece e o campo continua preenchido (a página não recarregou); o clique em
  Atualizar recarrega e o controlador novo (o da revisão nova) assume. Um pedaço que some (404) mostra o aviso.
- Lint, typecheck, testes da web, E2E inteiro e Lighthouse no celular (mediana de 3) mantendo 99–100/100/100/100.
