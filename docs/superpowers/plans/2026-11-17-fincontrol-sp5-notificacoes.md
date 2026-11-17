# Plano — Sub-projeto 5, Parte A: central de notificações

**Spec:** `docs/superpowers/specs/2026-11-17-fincontrol-sp5-notificacoes-design.md`
**Branch:** `feat/notificacoes`
**Execução:** direta, com TDD, um commit por tarefa. **Tem migration** — produção só com o comando do usuário.

## Tarefa 1 — Domínio e contratos (`packages/shared`)
- [ ] `notifications.ts`: `notificationPrefs`, `dueSoon`, `daysLabel`, `sortNotifications`, `goalReachedVisible`, com testes.
- [ ] Schemas: `markReadSchema`, `notificationPrefsSchema`, `NotificationDTO`; `notificationPrefs` em `ProfileDTO` e no `updateProfileSchema`.
- Commit: `feat(shared): regras e contratos das notificações`

## Tarefa 2 — Banco
- [ ] Prisma: `Notification` e `profiles.notification_prefs`; migration com RLS.
- Commit: `feat(db): notificações e preferências`

## Tarefa 3 — API
- [ ] `modules/notifications`: coleta das regras N4 reaproveitando repositórios (lançamentos pendentes, `cardDebt`, `budgets.summary`, metas), memória (upsert de `lastActiveAt`, `readAt`), rotas.
- [ ] Perfil com preferências; limpeza de 60 dias no cron.
- [ ] Testes de integração (seção 7).
- Commit: `feat(api): central de notificações`

## Tarefa 4 — Demo
- [ ] Despesa vencendo em 2 dias e meta concluída; teste da demo com todos os tipos.
- Commit: `feat(demo): avisos de todos os tipos`

## Tarefa 5 — Web
- [ ] Sino com contador no cabeçalho; página `/notificacoes`; preferências no Perfil; chave `notifications` nas invalidações.
- [ ] Testes.
- Commit: `feat(web): sino, central de notificações e preferências`

## Tarefa 6 — E2E, docs e revisão
- [ ] `e2e/tests/notificacoes.spec.ts`; 360 px cobre `/notificacoes`; screenshot.
- [ ] HANDOFF (inclui a pendência do dia da compra do sub-projeto 4), README.
- [ ] Revisão final, PR, CodeRabbit, **parar para o comando da migration**, merge, conferência em produção.
