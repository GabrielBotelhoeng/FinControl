# FinControl

Plataforma de gestão financeira pessoal: contas, receitas, despesas, transferências, recorrências e dashboard. Projeto de portfólio.

> Em construção. Sub-projeto 1, parte 1: API. Veja a [spec](docs/superpowers/specs/2026-11-11-fincontrol-fundacao-fluxo-caixa-design.md).

## Stack

Monorepo com npm workspaces:

- `apps/api`: Express 5, TypeScript, Prisma 7 e PostgreSQL.
- `packages/shared`: schemas Zod e utilitários compartilhados.

## Rodando localmente

Pré-requisitos: Node 22 e Docker.

```bash
npm install
npm run db:up                         # Postgres na porta 5435 (dev + test)
cp apps/api/.env.example apps/api/.env
npm run db:migrate                    # aplica as migrations no banco de dev
npm run dev:api                       # http://localhost:3333/api/v1/health
```

## Qualidade

```bash
npm run lint
npm run typecheck
npm test        # unitários + integração contra Postgres real
```
