# FinControl — Sub-projeto 16: Visual claro e colorido

- **Data:** 2026-11-20
- **Status:** decisões tomadas pelo agente, com três pedidos do usuário no meio do caminho (seção 6). O usuário achou o FinControl "bem black, escuro" e pediu um visual mais colorido, com o celular em primeiro lugar. A referência foi um vídeo de outro app (tema claro, destaque verde-limão, formulário que sobe de baixo e barra de abas embaixo). A identidade continua própria: o contraste de peso no saldo, a organização das telas e o texto.
- **Banco:** sem migration. A API só muda a cor do PDF e da planilha.

## 1. Decisões

| # | Decisão | Alternativas descartadas | Motivo |
|---|---|---|---|
| L1 | **O claro vira o padrão.** Quem nunca escolheu um tema passa a ver o claro; quem escolheu "Escuro" ou "Sistema" no Perfil continua com a escolha. Um script pequeno no `index.html` aplica o tema guardado antes do app carregar. | "Sistema" como padrão | Muitos celulares estão no modo escuro, e o pedido foi sair do escuro. O script evita o clarão de um tema errado ao abrir. |
| L2 | **Marca verde-limão** (`#C8F24B`) nos preenchimentos: botão principal, cartão do saldo, item ativo do menu, o "+" da barra e o "pago" do lançamento, sempre com texto escuro. Links, ícones de destaque e o "Control" do logo usam o verde-folha `#3D7A00` no claro (contraste de 4,6 a 5,3:1 nos fundos do app) e o próprio limão no escuro. | Manter o dourado; limão como cor de texto; o verde-oliva `#3F6212` | O dourado sai a pedido. Limão sobre branco tem contraste 1,3:1. O oliva deixava os links com cara de texto comum. |
| L3 | **Cores de apoio** (`lib/palette.ts` e `index.css`): tangerina, uva, céu, banana, rosa, turquesa, índigo e ardósia, só em decoração (a moeda do cartão do saldo, os quadrados dos indicadores e do "Mais", os brilhos da entrada). Verde e vermelho continuam só em receita e despesa. | Gradientes coloridos no fundo | Cor em pontos certos fica viva sem cansar e sem disputar com os valores. |
| L4 | **Saldo num cartão verde-limão** no painel, com a moeda tangerina, um ponto uva e um anel discreto no canto (o anel é um fundo, não um elemento, para nada passar da borda). O número mantém "R$" e centavos finos com os reais em extra-negrito. Receitas e despesas do mês ficam em cartões verde-claro e vermelho-claro, e os três indicadores em cartões pastel (céu, uva e tangerina). | Saldo solto sobre a aurora dourada | É o primeiro elemento que se vê e o que muda a cara do app. |
| L5 | **Ícones de traço (Lucide) em quadrados preenchidos com a cor** da categoria, da conta ou de apoio, com o traço branco ou escuro, o que contrastar mais (`IconTile`). Vale para lançamentos, categorias, orçamento, relatórios, gráfico do painel, contas, bens e a folha "Mais". O nome guardado na API não muda. | Ilustrações 3D do Fluent Emoji (testadas e descartadas: o usuário achou com "cara de IA"); emoji do sistema | É o estilo dos apps de finanças brasileiros e fica nítido em qualquer tamanho. |
| L6 | **Barra do celular nova:** flutuante, com cantos arredondados e cinco posições: Painel, Lançamentos, "+" (novo lançamento em qualquer tela), Contas e Mais. "Mais" abre uma folha com as outras telas em quadrados coloridos e fica marcado quando a tela aberta é uma delas. A coluna de "Lançamentos" é mais larga para o rótulo caber a 360 px. Substitui a P9 e a R12 (barra com seis itens). | Manter os seis itens | Com seis itens, os rótulos ficavam em 10 px e não havia atalho para lançar. Lançar é o que mais se faz no celular. |
| L7 | **No celular, os formulários sobem de baixo** como uma folha: alça no topo, cantos de 28 px, até 92% da altura e rolagem própria, com animação curta (desligada para quem pede menos movimento). No computador, o diálogo continua no centro. | Tela cheia (como antes) | A folha mostra de onde a pessoa veio e é o padrão dos apps de celular. |
| L8 | **Formulário de lançamento:** o valor em destaque (campo grande, na fonte de display) e o tipo com a cor dele (despesa em vermelho-claro, receita em verde-claro, transferência em limão). | Campos todos iguais | O valor é a informação principal; a cor do tipo evita lançar despesa como receita. |
| L9 | **Logo novo, a partir de uma referência do usuário:** o "F" de barras inclinadas com a seta de crescimento e três barrinhas em limão, num quadrado quase-preto; "Fin" na cor do texto e "Control" no verde da marca. O mesmo desenho é o ícone do app (192, 512, maskable com a zona segura de 80% e Apple) e o favicon. | O "F" com a moeda tangerina (primeira versão deste sub-projeto) | O usuário mandou a referência e pediu "nessa pegada". |
| L10 | **Tela de entrada sem a arte dourada:** brilhos coloridos de fundo, o lema "Planeje · Controle · Realize" embaixo do logo, "sob controle." marcado em limão e uma prévia feita em código (o cartão do saldo com três lançamentos em volta). As imagens antigas saem do projeto. | Gerar uma arte nova | Não há ferramenta de imagem paga, e a composição em código fica leve e nítida em qualquer tela. |
| L11 | **O escuro continua** no Perfil, refeito com a mesma marca: limão sobre um quase-preto esverdeado. O dourado sai dos dois temas. | Tirar o escuro | Há quem confira as contas à noite. |
| L12 | **"Novo lançamento" do topo do painel e de Lançamentos some no celular**, porque o "+" da barra faz isso em qualquer tela. No computador, continua. | Dois botões iguais na mesma tela | Evita repetição na tela pequena. |
| L13 | **PDF e planilha** trocam o dourado pelo verde da marca (`#3F6212`, com texto branco a 7:1 nos cabeçalhos) e pelo limão claro nas faixas e nas abas. | Manter o dourado | O relatório é parte da identidade. |
| L14 | **DESIGN.md reescrito** ("Feira de manhã"): cores, regras e componentes novos. | — | É a referência das próximas telas. |

## 2. Cores

| Token | Claro (padrão) | Escuro |
|---|---|---|
| `--background` | `#F5F6F0` | `#0B0D09` |
| `--surface` | `#FFFFFF` | `#14170F` |
| `--surface-2` | `#EEF0E7` | `#1C2016` |
| `--border` | `#E2E5D8` | `#2A2F22` |
| `--text` | `#14170F` | `#EEF1E6` |
| `--text-muted` | `#5F6657` | `#9AA290` |
| `--primary` (links, ícones, foco, barras) | `#3D7A00` | `#C8F24B` |
| `--primary-fg` | `#FFFFFF` | `#14170F` |
| `--primary-soft` | `#EAF5C8` | `#26301A` |
| `--brand` / `--brand-fg` | `#C8F24B` / `#14170F` | iguais |
| `--income` / `--income-soft` | `#07794A` / `#E1F4EA` | `#3DD68C` / `#0E2A1E` |
| `--expense` / `--expense-soft` | `#C62E49` / `#FBE6EA` | `#FF6B81` / `#2E1219` |
| Apoio (`PALETTE`) | tangerina `#FF8A3D`, uva `#7C5CFF`, céu `#38BDF8`, banana `#FFD43B`, rosa `#F472B6`, turquesa `#2DD4BF`, índigo `#6366F1`, ardósia `#64748B` | iguais |
| Pastel (`*-soft`) | céu 18%, uva 12%, tangerina 18% e banana 24% da cor sobre a superfície | o mesmo cálculo sobre a superfície escura |

Contraste conferido (texto ≥ 4,5:1): tinta sobre limão 14:1; verde-folha de 4,6 a 5,3:1 nos fundos do app; texto secundário de 4,9 a 5,5:1 nos cartões pastel; receita e despesa acima de 4,5:1 nos próprios cartões e nos pastel.

## 3. Web

- `styles/index.css`: os tokens acima, `--brand`, as cores de apoio, os pastel, `.brand-ring` e as animações `sheet-up` e `fade-in`.
- `theme.tsx`: padrão `light`; "Sistema" resolve pelo `prefers-color-scheme: dark`, como o script do `index.html`.
- `Button` primário, item ativo do menu do computador e "pago" na linha do lançamento: `bg-brand text-brand-fg`.
- `Dialog`: folha de baixo no celular (L7).
- `AppShell`: barra flutuante (L6), o "+" que abre o formulário de lançamento e a folha "Mais" (que fecha ao trocar de tela).
- `IconTile` e `lib/palette.ts` (L5), `Logo` e `LogoMark` (L9).
- Painel (L4), formulário de lançamento (L8), entrada (L10), ícone do app e manifest (L9).
- Relatórios: os nomes longos de categoria cortam com "…" a 360 px (o quadrado de ícone, maior que o ícone solto, empurrava a linha 2 px além da tela).
- Corrige `text-primary-foreground` (classe que não existia) nas mensagens do assistente.

## 4. Testes

- Tema: o padrão é o claro, com a cor do navegador do fundo claro; quem escolheu o escuro continua nele; "Sistema" segue o aparelho.
- Barra do celular: Painel, Lançamentos e Contas, o "+" e o "Mais"; o "+" abre "Novo lançamento" em qualquer tela; o "Mais" lista as outras telas e fecha ao escolher uma, e fica marcado nelas.
- `IconTile`: traço branco nas cores escuras e escuro nas claras; as categorias padrão, os tipos de conta e de bem têm ícone próprio.
- E2E: a 360 px, os rótulos da barra cabem, o "+" abre o formulário e o "Mais" leva a Dívidas; nenhuma página passa da borda.
- Contagem: 262 testes na web e 372 na API, além de 19 E2E (novo: o da barra do celular, em `mobile-e-publico.spec.ts`). As imagens do README foram refeitas.

## 5. Fora deste sub-projeto

- Esconder os valores (o "olho"), escolher a cor da marca e animações de entrada por tela.
- O site de apresentação e a assinatura (próximos sub-projetos, na ordem de `fincontrol-visao-produto`).

## 6. Pedidos do usuário durante o sub-projeto

- **Pesquisa no navegador dele** (paletas, ideias e skills): no Coolors, as paletas com limão mais curtidas ("Vibrant Spring Delight" e "Mossy Stone Serenity") confirmaram o limão com tangerina, uva e azul sobre um quase-branco esverdeado; no Dribbble, os apps de finanças claros usam cartões coloridos lado a lado e indicadores em tons pastel (entraram em L4). Skills: a de controlar o mouse é a "computer use" (só no app Claude para computador) ou o clawdcursor (código aberto; não instalado, porque controla o computador inteiro e depende do ok do usuário).
- **Logo "nessa pegada"** (imagem de referência com o "F", a seta e as barras): L9.
- **"Esses ícones não tá muito cara de IA?"** sobre as ilustrações 3D: trocadas pelos ícones de traço em quadrados coloridos (L5).

## 7. Revisão final (revisor novo e CodeRabbit)

- **Corrigidos, com teste quando cabe:**
  - a folha "Mais" reabria ao voltar e avançar no navegador (CodeRabbit). Agora a troca de tela a fecha, e fecha também o formulário do "+", como fechavam os diálogos de cada página;
  - o "Mais" ganhou `aria-expanded` e `aria-current` nas telas da folha;
  - o "pago" do lançamento e o ícone escolhido na categoria dependiam só do limão (1,3:1 contra o branco) e ganharam um contorno escuro;
  - o foco do teclado no link "Ver patrimônio" sumia no cartão limão no tema escuro;
  - o brilho limão da entrada apagava o lema no escuro, no celular, e ficou mais fraco nesse tema;
  - os testes de troca de tema passavam por acaso (trocavam para o claro, que já é o padrão) e passaram a trocar para o escuro.
- **Ajustado junto:** os botões de excluir usam a variante "danger" do `Button`, em vez de trocar a cor por classe (sem tailwind-merge, a cor certa dependia da ordem das classes no CSS). Em Perfil → Aparência, "Claro" aparece primeiro.
