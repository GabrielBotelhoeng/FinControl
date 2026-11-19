# FinControl — Sub-projeto 12: Primeiros passos (primeiro acesso guiado)

- **Data:** 2026-11-19
- **Status:** decisões tomadas pelo agente. É o "primeiro acesso guiado" da seção "Design" de `docs/pesquisa-concorrentes-2026-11-18.md`. Hoje uma conta nova abre o painel vazio, com zeros.
- **Banco:** nada muda (sem migration).

| # | Decisão | Alternativas descartadas | Motivo |
|---|---|---|---|
| G1 | **Quadro "Primeiros passos" no topo do painel**, só para contas reais (a demo já vem com dados). São quatro passos: cadastrar uma conta, fazer o primeiro lançamento, definir um limite no orçamento e criar uma meta. A barra de progresso mostra "N de 4". | Assistente em tela cheia na primeira entrada | O quadro guia sem prender: a pessoa pode explorar o app antes. |
| G2 | **Feito = existe.** `GET /onboarding` devolve `{ account, transaction, budget, goal }`, cada um verdadeiro quando há pelo menos um registro: uma conta (cartão também), um lançamento (pago ou pendente, inclusive importado), um limite ou uma meta. | Marcar à mão; guardar o progresso no banco | O progresso sai dos dados e nunca fica desatualizado. Quem já usa o app tem tudo feito e nem vê o quadro. |
| G3 | **O quadro some sozinho** quando os quatro passos estão feitos. Antes disso, "Ocultar" o esconde, e a escolha fica no navegador (por pessoa). | Coluna no perfil | É só uma conveniência, e uma coluna pediria migration. Em outro aparelho, o quadro volta até ser ocultado lá ou até os passos acabarem. |
| G4 | **Cada passo leva direto ao formulário:** Contas com "Nova conta" aberto (`/contas?novo=1`, o mesmo padrão do atalho de Lançamentos), Lançamentos com o formulário aberto (`/lancamentos?novo=1`) ou a importação de extrato, Planejamento (orçamento) e a aba Metas. | Só texto explicando | Um toque até o formulário. |
| G5 | **Passo feito** aparece riscado de leve, com o ícone de concluído e o texto "Feito" para leitor de tela. A barra é um `progressbar` com o valor. | Só o ícone | A situação não depende só da cor nem do ícone. |
| G6 | **Erro ao buscar os passos:** o quadro não aparece. | Mensagem de erro no painel | Os passos são uma ajuda; o painel continua funcionando sem eles. |

## API

- `GET /onboarding` → `{ account: boolean, transaction: boolean, budget: boolean, goal: boolean }`. São quatro consultas de existência, por pessoa.

## Web

- `OnboardingCard` em `features/dashboard/`, entre o seletor de mês e o saldo. A chave `onboarding` entra nas chaves invalidadas por qualquer mudança financeira, para o passo virar "feito" assim que a pessoa volta ao painel.
- Contas passa a aceitar `?novo=1`, que abre "Nova conta" e sai da URL logo em seguida, como em Lançamentos.

## Testes

- API: a pessoa nova tem tudo falso, cada passo vira verdadeiro com o próprio registro e os dados de outra pessoa não contam.
- Web: progresso, links, quadro escondido com tudo feito, "Ocultar" lembrado e nada na demo; `?novo=1` em Contas.
- E2E: uma conta nova a 360 px vê o quadro sem rolagem horizontal, cadastra a conta pelo passo, volta com "1 de 4" e oculta o quadro, que continua oculto depois de recarregar.
