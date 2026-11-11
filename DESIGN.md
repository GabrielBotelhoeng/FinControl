# FinControl — DESIGN

## Mundo visual: "Aurora no cofre"

O app é um cofre escuro e silencioso, onde o dinheiro brilha. A referência de linguagem é o portfólio corahub.com.br: fundo quase preto, um **glow radial** de cor e headlines que alternam **peso fino e extra-negrito**. A identidade é própria, com **dourado** no lugar do laranja da marca deles: é o ouro do cofre, quente como a referência e sem cair no clichê roxo/azul de "UI de IA" (proibido pela skill design-taste-frontend).

- **Cena de uso:** pessoa conferindo as contas no celular, à noite, ou no notebook durante o dia. Por isso o **escuro é o padrão**; o claro fica disponível no perfil.
- **Âncora de diferenciação:** o **saldo como herói**. O número é enorme, com "R$" e os centavos em peso fino e os reais em extra-negrito, sobre uma aurora dourada que respira atrás dele. Esse é o elemento que se reconhece sem o logo.
- **DFII:** impacto 4, encaixe 5, viabilidade 5, performance 4, risco de consistência 2, o que dá **16**. Na escala até 15 do skill, fica em "executar por completo".

## Tipografia

- **Display — Outfit Variable** (100–900): usada nos títulos, no saldo herói e nos valores em destaque. Faz o contraste entre peso 200 e peso 800 ("Seu dinheiro, **sob controle**.").
- **Texto e UI — Manrope Variable**: rótulos, listas e formulários. Os números sempre em `tabular-nums`.
- **Escala:** 12 / 14 / 16 / 20 / 28 / 40 / 64 (o 64 só no saldo herói e no título da entrada). Tracking mínimo de -0.03em nos displays.

## Cor (CSS variables em `apps/web/src/styles/index.css`)

| Token | Escuro (padrão) | Claro |
|---|---|---|
| `--background` | `#07080C` | `#F6F6F9` |
| `--surface` | `#0F121A` | `#FFFFFF` |
| `--surface-2` | `#161A24` | `#EFEFF4` |
| `--border` | `#232838` | `#E0E1E8` |
| `--text` | `#EEF0F6` | `#10121A` |
| `--text-muted` | `#9AA1B5` | `#5A6072` |
| `--primary` | `#E8B04B` | `#8A5A00` |
| `--primary-fg` | `#1A1305` | `#FFFFFF` |
| `--primary-soft` | `#2A2111` | `#F7EDD8` |
| `--glow` | `rgba(232,176,75,0.26)` | `rgba(200,140,30,0.18)` |
| `--income` | `#3DD68C` | `#0A8754` |
| `--income-soft` | `#0E2A1E` | `#E1F4EA` |
| `--expense` | `#FF6B81` | `#D23752` |
| `--expense-soft` | `#2E1219` | `#FBE6EA` |
| `--warning` | `#FF6B81` (= despesa) | `#D23752` |

Regras de cor:
- **Uma cor dominante:** o dourado (`--primary`), sobre neutros frios quase pretos. O "vencido" usa a cor de despesa, não um terceiro acento.
- **Verde e vermelho só em valores de receita e despesa.** Nunca como decoração.
- **Gradientes só no glow de fundo**, como aurora radial desfocada. Nada de texto em gradiente, nada de vidro decorativo.

## Forma e profundidade

- **Botões:** em pílula (`rounded-full`). O primário é preenchido; o secundário tem contorno de 1px em `--border` e preenche no hover.
- **Superfícies:**
  - Raio de 20 px nos painéis e de 12 px nos controles.
  - No escuro, a profundidade vem da borda e de uma luz interna (`inset 0 1px 0 rgba(255,255,255,.04)`); no claro, de sombra com deslocamento e blur suave.
  - Nada de cards aninhados.
- **Ícones:** Lucide, traço de 1.75.

## Movimento

- **Um momento autoral por tela:** a aurora atrás do saldo pulsa lentamente (8 s, `opacity` e `scale`), e os números do resumo entram com contagem curta (400 ms, ease-out exponencial).
- **Hover sutil** em pílulas e linhas de lista.
- **Tudo desligado** com `prefers-reduced-motion`.

## Superfícies do navegador

A seleção de texto usa `--primary-soft` com `--text`. O caret é `--primary`. A scrollbar é fina, com o thumb em `--border`. O anel de foco tem 2px em `--primary`, com offset de 2px sobre `--background`.

## Copy

O tom é direto e encorajador, em segunda pessoa ("Você gastou 12% a menos que em outubro"). Os botões nomeiam a ação ("Lançar despesa", "Marcar como pago"), e os erros dizem o problema e o que fazer.
