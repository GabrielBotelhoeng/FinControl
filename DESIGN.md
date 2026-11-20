# FinControl — DESIGN

## Mundo visual: "Feira de manhã"

O app é claro e alegre como uma feira de manhã: fundo quase branco, um **verde-limão** que marca o que importa e cores de fruta em pontos certos. O dinheiro continua sério (verde só para receita, vermelho só para despesa); a alegria fica na moldura. Sub-projeto 16 (`docs/superpowers/specs/2026-11-20-fincontrol-sp16-visual-claro-design.md`).

- **Cena de uso:** pessoa lançando um gasto no celular, na fila do mercado, ou conferindo o mês no notebook. Por isso o **claro é o padrão** e o celular vem primeiro; o escuro continua no Perfil.
- **Âncora de diferenciação:** o **saldo num cartão verde-limão**, com "R$" e centavos em peso fino e os reais em extra-negrito, e a moeda tangerina no canto.
- **Logo:** o "F" de barras inclinadas com a seta de crescimento e três barrinhas em limão, num quadrado quase-preto (`LogoMark`, igual ao `public/icon.svg`). Ao lado, "Fin" na cor do texto e "Control" no verde da marca. Na entrada, o lema "Planeje · Controle · Realize".

## Tipografia

- **Display — Outfit Variable** (100–900): títulos, o saldo, os valores em destaque e o logo. Faz o contraste entre peso 200 e 800 ("Seus **lançamentos**").
- **Texto e UI — Manrope Variable**: rótulos, listas e formulários. Os números sempre em `tabular-nums`.
- **Escala:** 12 / 14 / 16 / 20 / 28 / 40 / 64. Tracking mínimo de -0.03em nos displays.

## Cor (CSS variables em `apps/web/src/styles/index.css`)

| Token | Claro (padrão) | Escuro |
|---|---|---|
| `--background` | `#F5F6F0` | `#0B0D09` |
| `--surface` | `#FFFFFF` | `#14170F` |
| `--surface-2` | `#EEF0E7` | `#1C2016` |
| `--border` | `#E2E5D8` | `#2A2F22` |
| `--text` | `#14170F` | `#EEF1E6` |
| `--text-muted` | `#5F6657` | `#9AA290` |
| `--primary` (links, ícones, foco, barras) | `#3D7A00` | `#C8F24B` |
| `--primary-soft` | `#EAF5C8` | `#26301A` |
| `--brand` / `--brand-fg` (preenchimento limão) | `#C8F24B` / `#14170F` | iguais |
| `--income` / `--income-soft` | `#07794A` / `#E1F4EA` | `#3DD68C` / `#0E2A1E` |
| `--expense` / `--expense-soft` | `#C62E49` / `#FBE6EA` | `#FF6B81` / `#2E1219` |

**Cores de apoio** (`apps/web/src/lib/palette.ts`, iguais nos dois temas): tangerina `#FF8A3D`, uva `#7C5CFF`, céu `#38BDF8`, banana `#FFD43B`, rosa `#F472B6`, turquesa `#2DD4BF`, índigo `#6366F1` e ardósia `#64748B`. Os fundos pastel (`bg-sky-soft`, `bg-grape-soft`, `bg-tangerine-soft`, `bg-banana-soft`) são a cor misturada à superfície, então funcionam nos dois temas.

Regras de cor:
- **Limão é preenchimento, nunca texto** sobre claro (contraste 1,3:1). Texto sobre limão é sempre `--brand-fg`. Para texto e ícone de destaque, `--primary`.
- **Verde e vermelho só em receita e despesa** (valores, cartões do mês, o tipo no formulário). O "vencido" usa a cor de despesa.
- **Cores de apoio só em decoração**: quadrados de ícone, a moeda do cartão do saldo, os cartões dos indicadores e os brilhos da entrada. Nunca como o único sinal de um estado: status sempre com ícone e texto.

## Forma e profundidade

- **Botões:** em pílula (`rounded-full`). O primário é limão com texto escuro; o secundário tem contorno de 1px em `--border`.
- **Superfícies:** raio de 20 px nos painéis, 28 px nos cartões de destaque e nas folhas do celular, e 12 px nos controles. No claro, a profundidade vem de uma sombra suave; no escuro, da borda e de uma luz interna. Nada de cards aninhados.
- **Ícones:** Lucide, traço de 1.75 (2 dentro dos quadrados). Categoria, conta, bem e os atalhos do "Mais" usam o **`IconTile`**: um quadrado arredondado preenchido com a cor, com o traço branco ou escuro, o que contrastar mais. Nada de ilustrações 3D ("cara de IA", decisão do usuário).

## Celular primeiro

- **Barra flutuante** embaixo: Painel, Lançamentos, o "+" limão (novo lançamento em qualquer tela), Contas e Mais. "Mais" abre a folha com as outras telas.
- **Formulários em folha** que sobe de baixo, com alça, até 92% da altura. No computador, diálogo no centro.
- Toda tela é conferida a 360 px sem rolagem horizontal (`e2e/tests/mobile-e-publico.spec.ts`).

## Movimento

- **Folha subindo** (260 ms) e fundo escurecendo (200 ms); o "+" afunda um pouco ao tocar.
- **Hover sutil** em pílulas e linhas de lista.
- **Tudo desligado** com `prefers-reduced-motion`.

## Superfícies do navegador

A seleção de texto usa `--primary-soft` com `--text`. O caret e o anel de foco (2px, offset de 2px) usam `--primary`. A scrollbar é fina, com o thumb em `--border`. A `theme-color` é o fundo do tema (`#F5F6F0` ou `#0B0D09`), e o ícone do app é o `LogoMark`.

## Copy

O tom é direto e encorajador, em segunda pessoa ("Você gastou 12% a menos que em outubro"). Os botões nomeiam a ação ("Salvar lançamento", "Marcar como pago"), e os erros dizem o problema e o que fazer.
