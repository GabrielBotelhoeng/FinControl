# Sub-projeto 17: site de apresentação — design

_2026-11-24 · Orquestrador (Modo Maestro) · branch `feat/site-apresentacao` · base `main` d304dc7_

## 1. Objetivo

Uma página pública que apresenta o FinControl a quem ainda não usa, mostra os planos e os valores e leva para **"Experimentar sem cadastro"**. Pedido do usuário (memórias de 2026-11-19 e 2026-11-20): cobrar no futuro uma assinatura mensal barata, celular em primeiro lugar, o visual claro e colorido do `DESIGN.md` ("Feira de manhã"), um site **muito animado**, sem ilustrações 3D com "cara de IA", com imagens que sejam **capturas reais do app** e composições em código, e sem novos serviços pagos.

Referência obrigatória: **corahub.com.br** (analisada no portal "Pesquisa" em 2026-11-24). O que se aproveita, adaptado e sem copiar:
- o título enorme que mistura peso fino e extra-negrito ("Criamos **páginas** que **vendem!**"), que já combina com a nossa Outfit 200/800;
- os botões em pílula, com uma chamada principal forte;
- a **faixa rolante** de benefícios embaixo das peças, que vira a nossa faixa limão;
- o celular com cartões flutuando em volta;
- a chamada final única no fim da página.

O que **não** se aproveita: o fundo escuro com brilho laranja (nosso padrão é claro), as fotos de pessoas, o 3D brilhante e a vitrine de trabalhos (não somos uma agência).

## 2. Decisões (S1–S14)

| # | Decisão | Motivo |
|---|---|---|
| S1 | **O site mora no próprio `apps/web`, na rota `/`**, para quem não tem sessão. Quem tem sessão continua vendo o painel em `/`. As outras rotas protegidas continuam mandando para `/entrar`. | Mesmo domínio e mesmo deploy (nenhum projeto novo na Vercel, nenhum custo), os mesmos tokens e componentes, e o botão da demo é o mesmo fluxo da entrada, sem CORS nem CSP novos. A raiz do domínio é o endereço que se divulga, então é ela que precisa vender. Um app separado (Astro) daria HTML estático melhor para SEO, mas duplicaria o visual e o deploy; fica registrado como evolução (S14). |
| S2 | **App instalado (PWA) não vê o site.** Sem sessão, em `display-mode: standalone`, a `/` leva para `/entrar`. | Quem instalou o app quer entrar, não ler a apresentação. O `start_url` continua `/`. |
| S3 | **O site é um pedaço separado do bundle** (`lazy`) em `src/features/site/`, e a biblioteca de animação só entra nele. | O app de quem já usa não pode ficar mais pesado por causa do site. |
| S4 | **Animação com Motion** (`motion`, MIT, gratuita), com `MotionConfig reducedMotion="user"`. Só `transform` e `opacity`; nada de animar `width`, `height`, `top` ou `filter` em loop. O título principal e o primeiro botão **não** começam invisíveis (o LCP não pode esperar a animação). | API em React, `whileInView` e `useScroll` cobrem tudo que o site pede sem código de scroll à mão. O GSAP também é gratuito hoje, mas é imperativo e pesa mais para o mesmo resultado. Pedido de "muito animado" sem perder desempenho no celular. |
| S5 | **Seções**, nesta ordem: cabeçalho fixo, herói, faixa limão rolante, "Como funciona" (3 passos), recursos com as telas trocando no scroll, "No celular, como app" (PWA), "Seus dados", planos, perguntas, chamada final e rodapé (detalhe na seção 3). | A ordem responde às dúvidas de quem chega: o que é, como começo, o que faz, funciona no celular, é seguro, quanto custa. |
| S6 | **Preços provisórios**, num arquivo só (`src/features/site/pricing.ts`): **Grátis** (R$ 0) e **Completo** a **R$ 9,90 por mês** ou **R$ 99,00 por ano** (dois meses de graça). Na página, um selo "Preços de lançamento, provisórios" e a frase "Hoje todos os recursos estão liberados de graça". | O usuário quer uma assinatura "barata", e ainda não definiu o valor. Um preço abaixo de R$ 10 é o que se lê como barato, e o anual com dois meses grátis é o padrão do mercado. Ficar num arquivo só deixa a troca para uma linha. A frase evita prometer cobrança que ainda não existe. |
| S7 | **Nenhuma cobrança real nesta etapa.** Os dois planos levam para a demo ou para criar a conta. | A cobrança é outro sub-projeto (provedor de pagamento escolhido pelo usuário). |
| S8 | **Divisão provisória dos planos.** Grátis: contas, cartões e faturas, lançamentos, recorrências, orçamento, metas, calendário, importação de extrato e o app instalável. Completo: tudo do Grátis mais o assistente de IA, os relatórios em PDF e Excel, patrimônio, dívidas com plano de quitação, empréstimos com a comparação do Banco Central e os avisos no celular. | O que custa dinheiro para manter (a IA, que gasta créditos da Anthropic) e o que é mais avançado ficam no pago; o básico do dia a dia fica no grátis, para a pessoa criar o hábito. |
| S9 | **Imagens = capturas reais da demo**, geradas por um teste do Playwright (`e2e/tests/site-capturas.spec.ts`, só roda com `SITE_CAPTURES=1`, como o de screenshots do README), a 390 px (celular, 2x) e a 1440 px, salvas em WebP em `apps/web/public/site/`. Molduras de celular e de notebook feitas em CSS. Nada de 3D nem de imagem gerada por IA. | Pedido do usuário. Reaproveita a demo e o login falso que o E2E já tem; dá para refazer as imagens com um comando quando o app mudar. |
| S10 | **As imagens do site ficam fora do cache do PWA** (`globIgnores: ['site/**']`). | Quem instala o app não precisa baixar as fotos da apresentação. |
| S11 | **SEO:** título e descrição próprios, `canonical`, Open Graph e Twitter Card com uma imagem de 1200×630 (composição das capturas), JSON-LD `SoftwareApplication` com as `offers` dos planos e `FAQPage` com as perguntas, `robots.txt` e `sitemap.xml` (`/`, `/entrar`, `/privacidade`, `/termos`). Um título por página com `document.title`. | O Google executa o JavaScript do SPA, mas as prévias de link (WhatsApp, redes) leem só o HTML: por isso as tags vão no `index.html`, que é servido em todas as rotas. |
| S12 | **Acessibilidade:** marcos (`header`, `main`, `footer`, `nav`), um `h1` só, o limão nunca como cor de texto sobre claro, foco visível, perguntas num acordeão acessível por teclado, a faixa rolante pausada com `prefers-reduced-motion` e com o conteúdo também lido uma vez por leitor de tela (a cópia duplicada da faixa fica `aria-hidden`). | Regras do `DESIGN.md` e do projeto. |
| S13 | **Textos honestos.** Sem depoimentos, número de usuários ou notas inventados. | Não existem ainda; inventar seria propaganda enganosa. |
| S14 | **Fora do escopo:** cobrança, vídeo de apresentação, domínio próprio, blog, HTML pré-renderizado (Astro ou prerender) e tema escuro no site (o site é sempre claro). | Cada um é um passo à parte; o pré-render entra se o SEO pedir. |

## 3. Seções

1. **Cabeçalho fixo** (fica com fundo e sombra depois de rolar): logo; no computador, os links Recursos, Planos e Perguntas; "Entrar" e o botão limão "Experimentar". No celular, só o logo, "Entrar" e "Experimentar".
2. **Herói:** o lema "Planeje · Controle · Realize"; o `h1` "Seu dinheiro, **sob controle.**" (o mesmo da entrada, com o destaque limão); a frase de apoio; os botões "Experimentar sem cadastro" (limão) e "Criar conta grátis" (contorno), com o aviso dos 18 anos e dos termos, como na entrada. Ao lado (embaixo, no celular), um celular em CSS com a captura do painel e três cartões de lançamento flutuando (Mercado, Salário, Restaurante), que entram em sequência e acompanham o scroll com um paralaxe leve. O saldo do cartão limão conta de 0 até o valor.
3. **Faixa limão rolante** (de um lado para o outro, sem parar): "Contas e cartões · Faturas · Orçamento · Metas · Calendário · Importar extrato · Relatórios em PDF e Excel · Assistente de IA · Funciona no celular". A faixa fica um pouco inclinada, como na referência.
4. **Como funciona**, três passos numerados que entram em sequência: "Cadastre suas contas", "Lance ou importe o extrato", "Veja para onde vai o dinheiro".
5. **Recursos**: no computador, o texto de cada recurso rola à esquerda e a tela à direita fica presa e troca com um fade de acordo com o recurso em vista (Painel, Lançamentos, Cartões e faturas, Dívidas e plano de quitação, Relatórios, Assistente). No celular, cada recurso é um cartão com a captura embaixo do texto.
6. **No celular, como app**: explica que dá para instalar pela tela inicial (Android e iPhone, sem loja), que os dados ficam na nuvem e aparecem no computador e no celular, com as capturas de celular lado a lado.
7. **Seus dados**: quatro itens com ícone (`IconTile`): servidor no Brasil (São Paulo), acesso só com a sua conta, exclusão da conta e dos dados quando quiser (LGPD) e nada de venda de dados. Links para a privacidade e os termos.
8. **Planos**: a chave Mensal/Anual (pílula com o indicador deslizando); os dois cartões, o Completo em destaque limão; o preço anima ao trocar; o selo de provisório; os botões levam à demo.
9. **Perguntas** (acordeão): é grátis? preciso instalar? meus dados ficam seguros? funciona no iPhone? consigo importar o extrato do banco? posso apagar tudo? como a demo funciona?
10. **Chamada final**: um bloco limão grande com "Comece agora, sem cadastro" e o botão da demo.
11. **Rodapé**: logo, lema, links (Entrar, Privacidade, Termos) e o ano.

## 4. Movimento (pedido: "muito animado")

- Entrada do herói em sequência (lema, título, frase, botões: 60 ms entre eles), os cartões flutuando com uma oscilação lenta e o contador do saldo.
- Cada seção revela os filhos ao entrar na tela (`whileInView`, uma vez, a partir de 20% visível), subindo 24 px com opacidade.
- Paralaxe leve no celular do herói e nas capturas do "No celular" (`useScroll` + `useTransform`).
- Faixa rolante em CSS (`@keyframes` com `translateX`), que para com o mouse em cima e com `prefers-reduced-motion`.
- Telas dos recursos trocando com fade e escala de 0,98 para 1.
- Preço trocando com o número subindo ou descendo, e o indicador da chave deslizando (`layoutId`).
- Botões com o "afundar" do `DESIGN.md` ao tocar.
- Com `prefers-reduced-motion`: tudo aparece parado, já no lugar.

## 5. Arquivos

- `apps/web/src/features/site/`: `site-page.tsx` (a página), seções em arquivos próprios (`hero.tsx`, `marquee.tsx`, `how-it-works.tsx`, `features.tsx`, `mobile-app.tsx`, `privacy-block.tsx`, `pricing.tsx`, `faq.tsx`, `final-cta.tsx`, `site-header.tsx`, `site-footer.tsx`), `device-frame.tsx` (molduras em CSS), `pricing.ts` (valores e recursos de cada plano) e os testes.
- `apps/web/src/features/auth/use-start-demo.ts`: o início da demo sai da `login-page.tsx` para um hook usado pela entrada e pelo site.
- `apps/web/src/app/router.tsx`: a `/` passa por um portão (`HomeGate`): sem sessão mostra o site (ou `/entrar` no app instalado), com sessão o painel.
- `apps/web/index.html`: SEO (S11). `apps/web/public/`: `robots.txt`, `sitemap.xml`, `og-image.png` e `site/*.webp`.
- `apps/web/vite.config.ts`: `globIgnores` do PWA (S10).
- `e2e/tests/site.spec.ts` (o site a 360 e a 1440 px sem rolagem horizontal, a demo pelo site e a `/` com sessão no painel) e `e2e/tests/site-capturas.spec.ts` (S9). O teste "rota protegida sem sessão" continua valendo para `/lancamentos`.

## 6. Critérios de aceite

1. Sem sessão, `/` mostra o site; com sessão, o painel; `/lancamentos` sem sessão leva para `/entrar`; no app instalado sem sessão, `/` leva para `/entrar`.
2. "Experimentar sem cadastro" no site abre a demo no painel (mesmo fluxo da entrada).
3. Os planos mostram os valores de `pricing.ts`, a chave Mensal/Anual troca os preços e o selo de provisório aparece.
4. Nenhuma rolagem horizontal a 360, 390 e 1440 px.
5. Com `prefers-reduced-motion`, nada se move.
6. Lint, typecheck, testes unitários e E2E passando; o bundle do app logado não cresce mais que 2 KB (o site e o Motion ficam no pedaço do site).
7. Lighthouse no celular (prévia da Vercel): desempenho ≥ 85, acessibilidade ≥ 95, SEO ≥ 95.
8. As capturas são da demo real, sem 3D e sem imagem gerada.
9. `index.html` com título, descrição, canonical, Open Graph, Twitter Card e JSON-LD; `robots.txt` e `sitemap.xml` servidos.
