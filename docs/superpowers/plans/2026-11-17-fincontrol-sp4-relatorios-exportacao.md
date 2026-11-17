# Plano — Sub-projeto 4: Relatórios e exportação

**Spec:** `docs/superpowers/specs/2026-11-17-fincontrol-sp4-relatorios-exportacao-design.md`
**Branch:** `feat/relatorios`
**Execução:** direta, com TDD (teste vermelho → código → verde), um commit por tarefa. Sem migration.

## Tarefa 1 — Domínio (`packages/shared/src/reports.ts`)
- [ ] Testes de `reportPeriod`, `seriesMonths`, `changeRatio`, `cardDebtAt`, `loanOutstandingAt`, `csvCell`/`toCsv` e `pdfSafe` (spec seção 3).
- [ ] Implementar e exportar no `index.ts`.
- Commit: `feat(shared): regras dos relatórios (período, dívidas, CSV e texto do PDF)`

## Tarefa 2 — Contratos (`packages/shared/src/schemas/reports.ts`)
- [ ] `reportQuerySchema` (`from`/`to` AAAA-MM, `to >= from`, até 24 meses) com testes.
- [ ] `ReportDTO` e tipos internos; `DebtsDTO` em `DashboardSummaryDTO`.
- Commit: `feat(shared): contratos dos relatórios`

## Tarefa 3 — Dívidas (`apps/api/src/modules/reports/debts.ts`)
- [ ] Repositório: movimentos dos cartões (arquivados inclusive) e empréstimos com as datas das parcelas pagas.
- [ ] `debtsAt(userId, dates[])` usando `cardDebtAt` e `loanOutstandingAt`.
- [ ] `/dashboard/summary` ganha `debts` (R8). Testes de integração: compra parcelada, pagamento, empréstimo (igual ao `outstanding` da tela).
- Commit: `feat(api): total de dívidas no painel (cartões e empréstimos)`

## Tarefa 4 — Relatório (`GET /reports`)
- [ ] Repositório: totais, por categoria, maiores despesas, saldos por conta.
- [ ] Serviço `build(userId, from, to)` + rota; 422 para `to` no futuro.
- [ ] Testes: critério de aceite 1, categorias do período anterior, séries, dívidas, saldos, isolamento.
- Commit: `feat(api): relatório do período com comparação e evolução das dívidas`

## Tarefa 5 — CSV (`GET /reports/export.csv`)
- [ ] Lançamentos do período por competência, colunas da R9, BOM.
- [ ] Testes: cabeçalho, valores, pendente, fórmula, transferência.
- Commit: `feat(api): exportação dos lançamentos em CSV`

## Tarefa 6 — PDF (`GET /reports/export.pdf`)
- [ ] `npm i pdf-lib -w @fincontrol/api`; `report-pdf.ts` com layout A4 (resumo, categorias, evolução, dívidas, maiores despesas, saldos, nota).
- [ ] Testes: `%PDF`, abre no `pdf-lib`, páginas > 0, texto do resumo nas streams; descrição com emoji não quebra.
- Commit: `feat(api): relatório em PDF`

## Tarefa 7 — Pendências (R13)
- [ ] Juntar categorias move o limite quando o destino não tem; teste.
- [ ] `PUT /budgets/:id` devolve o id do banco; teste com UUID em maiúsculas.
- Commit: `fix(api): junção de categorias leva o limite; PUT de orçamento devolve o id gravado`

## Tarefa 8 — Web: página `/relatorios`
- [ ] `features/reports/api.ts` (query), `reports-page.tsx` com seletores, resumo, categorias, gráficos, tabelas, nota e estado vazio.
- [ ] Testes da página.
- Commit: `feat(web): página de relatórios`

## Tarefa 9 — Web: downloads
- [ ] `download` no `ApiClient` (blob com token), botões com carregando e erro.
- [ ] Testes do cliente e dos botões.
- Commit: `feat(web): baixar relatório em PDF e lançamentos em CSV`

## Tarefa 10 — Web: painel, navegação, perfil e categorias
- [ ] Indicador "Total de dívidas" e link "Ver relatórios" no painel.
- [ ] "Relatórios" no menu do computador (fora da barra do celular); link no Perfil.
- [ ] Aviso no diálogo de excluir categoria quando as duas têm limite.
- Commit: `feat(web): total de dívidas no painel e acesso aos relatórios`

## Tarefa 11 — E2E, documentação e revisão
- [ ] `e2e/tests/relatorios.spec.ts` (demo, números, downloads); 360 px cobre `/relatorios`.
- [ ] HANDOFF, README e screenshot.
- [ ] Lint, typecheck, todos os testes; revisão final da branch por um revisor novo.
- Commit: `test(e2e): relatórios e exportação; docs do sub-projeto 4`
