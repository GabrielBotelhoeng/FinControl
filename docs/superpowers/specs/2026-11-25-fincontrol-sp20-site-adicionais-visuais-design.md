# Sub-projeto 20: adicionais visuais no site de apresentação — design e plano

_2026-11-25 · Orquestrador (Modo Maestro) · branch `feat/site-adicionais-visuais` · base `main` 08b96f8. Complementa o sub-projeto 17 (site) e respeita o 18 (HTML estático, PageSpeed). O número 19 fica reservado para o aviso de nova versão do PWA._

## 1. Pedido do usuário (capturas do celular, 2026-11-25)

1. **Herói:** elementos animados flutuando no fundo, "para dar mais charme e chamar mais atenção", e uma **segunda faixa verde passando por dentro da outra**.
2. **Recursos e os vãos entre seções:** os mesmos elementos flutuando. No computador, ao rolar, ficam espaços grandes vazios (ex.: entre "Como funciona" e "Recursos"; no celular, o vão acima de RECURSOS).
3. **Seção do MacBook** ("No celular, como app"): a base do notebook "quase não dá pra ver", e ele quer **um iPad junto** do notebook e dos dois celulares.

Diagnóstico: as seções seguidas usam `py-20` (celular) e `md:py-28` (computador), o que soma 160 a 224 px de vazio entre uma e outra, sem nada no fundo. A base do `LaptopFrame` é uma barra clara quase da cor do fundo (`--surface-2`).

## 2. Decisões (V1–V10)

| # | Decisão | Motivo |
|---|---|---|
| V1 | **Camada de fundo flutuante** (`features/site/floating-backdrop.tsx`): elementos `aria-hidden`, `pointer-events: none`, atrás do conteúdo (`-z-10` dentro de uma seção `relative isolate overflow-hidden`), em posições definidas por seção. Tipos: blobs suaves (círculos e formas arredondadas com gradiente radial nas cores de fruta do `palette.ts`, baixa opacidade), moedas (círculo tangerina/banana com "R$"), ícones Lucide do app em `IconTile` (carteira, cartão, gráfico, porquinho, calendário, alvo) e 1 ou 2 mini-cartões de lançamento (como os do herói). Nada de 3D, brilho metálico ou imagem gerada. | Pedido do usuário, no estilo do `DESIGN.md` (cores de apoio só em decoração). |
| V2 | **Movimento:** cada elemento flutua com `@keyframes` em CSS (só `transform`: `translate` e `rotate`, de 6 a 14 s, `ease-in-out`, atrasos diferentes) e, no computador, um paralaxe leve no scroll (Motion `useScroll`, só `transform`). Com `prefers-reduced-motion`, tudo parado. A animação para fora da tela (`animation-play-state` com `IntersectionObserver`). | Animar só o que é barato (`transform`) e não gastar CPU com o que não aparece; acessibilidade. |
| V3 | **Quantidade:** no computador até 8 elementos por área; no celular (< 768 px) até 4, menores e mais transparentes, nunca atrás de texto pequeno. | Pedido do Maestro ("poucos elementos no celular") e leitura. |
| V4 | **Contraste:** os elementos que passam atrás de texto ficam com opacidade ≤ 0,35 (blobs ≤ 0,25), e o texto continua com contraste ≥ 4,5:1. A auditoria de contraste do Lighthouse continua passando (acessibilidade 100). | O fundo não pode atrapalhar a leitura. |
| V5 | **Segunda faixa no herói, em X:** a faixa atual (limão, inclinada para um lado, rolando para a esquerda) ganha outra cruzando por trás, com a inclinação oposta, rolando para a direita, no tom verde-folha (`--primary`, `#3D7A00`) com texto claro, e termos diferentes ("Sem planilha · Funciona no celular · Seus dados no Brasil · Grátis para começar · Importe o extrato · Avisos de vencimento"). A cópia duplicada de cada faixa fica `aria-hidden`, e o texto de cada uma é lido uma vez. As duas param com `prefers-reduced-motion` e com o mouse em cima. Sem rolagem horizontal a 360 px (o `overflow` fica na seção). | Pedido do usuário, com profundidade pelo tom mais escuro atrás. |
| V6 | **Vãos entre seções:** reduzir o espaço morto onde duas seções sem fundo se encontram (o `pb` da de cima ou o `pt` da de baixo, de `py-28` para `py-20` no computador e de `py-20` para `py-14` no celular nesses encontros) e usar os elementos flutuantes para dar vida ao que sobrar. O ritmo vertical continua uniforme. | Pedido do usuário; menos vazio sem perder respiro. |
| V7 | **MacBook com cara de MacBook:** o `LaptopFrame` ganha base visível: a tampa com borda escura e sombra mais marcada, e a base em alumínio (gradiente `#D9DCD3` → `#B9BDB2` com borda `#9EA396`), a reentrância da abertura no meio da frente e a sombra no chão (elipse escura borrada com opacidade baixa). Contraste da base contra o fundo da seção ≥ 3:1 (componente gráfico). | A base hoje some no fundo claro. |
| V8 | **iPad:** nova moldura `TabletFrame` em CSS (cantos arredondados, borda escura fina, câmera na borda), com uma captura real da demo em tamanho de tablet (`painel-tablet.webp`, nova no `site-capturas.spec.ts`, viewport 820×1180, 2x, convertida pelo `site:images`). Composição: o iPad em pé atrás/ao lado do notebook, à esquerda, com os dois celulares à direita, sem sobrepor demais as telas. A 360 px tudo cabe sem cortar (o iPad pode ficar menor e mais para trás). | Pedido do usuário; imagem real, nada gerado. |
| V9 | **HTML estático e desempenho:** tudo continua no prerender do sub-projeto 18 (sem diferença entre servidor e cliente; os elementos de fundo entram no HTML com posição absoluta e tamanho fixo, sem CLS). O LCP continua sendo a captura do herói: os elementos de fundo são pequenos ou CSS/SVG, sem imagem grande. A captura do tablet é `loading="lazy"` com `width`/`height`. | Manter o PageSpeed em 100 nos quatro e o CLS 0. |
| V10 | **Fora do escopo:** tema escuro no site, mudança de textos e de preços, vídeo. | — |

## 3. Plano (executor: Frontend; um commit por tarefa; sem push)

- **T1 — Camada flutuante (V1–V4):** `floating-backdrop.tsx` com os tipos e as animações; aplicar no herói, em "Como funciona", nos Recursos, no "No celular" e nos encontros entre seções. Testes: `aria-hidden`, `pointer-events-none`, reduced-motion parado, até 4 no celular.
- **T2 — Segunda faixa em X (V5):** `marquee.tsx` ganha a variante de trás; teste do texto lido uma vez e das duas pausando com reduced-motion.
- **T3 — Vãos (V6):** ajustar os espaçamentos; conferir a 1440, 390 e 360 px.
- **T4 — MacBook e iPad (V7, V8):** `LaptopFrame` com a base nova, `TabletFrame`, a captura `painel-tablet` (`SITE_CAPTURES=1 npm run test:e2e -- site-capturas` e `npm run site:images -w @fincontrol/web`) e a composição no `mobile-app.tsx`.
- **T5 — E2E e medições:** `site.spec`/`site-estatico.spec` sem rolagem horizontal a 360/390/1440 e sem erro de hidratação; capturas de antes e depois das 3 áreas (herói, recursos, MacBook) a 1440 e 390 px; Lighthouse no celular (mediana de 3) com desempenho 99–100, acessibilidade 100 e CLS 0.
- **T6 — Docs:** HANDOFF com a seção do sub-projeto 20.

## 4. Critérios de aceite

1. Herói, Recursos e os vãos com elementos flutuando no fundo (celular e computador), sem atrapalhar a leitura.
2. Duas faixas em X no herói, em sentidos opostos, sem rolagem horizontal a 360 px.
3. Vãos entre seções menores e preenchidos.
4. Base do notebook visível e com cara de MacBook; iPad com captura real da demo; nada cortado a 360 px.
5. `prefers-reduced-motion`: tudo parado. Só `transform`/`opacity` animados.
6. Lighthouse no celular: desempenho ≥ 99, acessibilidade 100, boas práticas 100, SEO 100, CLS 0; PageSpeed em produção 100/100/100/100 no celular e no computador.
7. Lint, typecheck, testes e E2E verdes.
