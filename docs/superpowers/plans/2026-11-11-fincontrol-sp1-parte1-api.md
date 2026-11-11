# FinControl SP1 — Parte 1: API (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a API REST do sub-projeto 1, rodando e testada localmente contra um Postgres real: contas, categorias, lançamentos, recorrências, dashboard, perfil, conta demo e limpeza de demos.

**Architecture:** Monorepo com npm workspaces. A API Express 5 é organizada em camadas: o `*.routes.ts` faz o papel de controller (HTTP ↔ service), depois vêm `*.service.ts` (regras de negócio) e `*.repository.ts` (único ponto de acesso ao Prisma, sempre filtrado por `userId`). As regras puras ficam em `src/domain/`, sem I/O. Os schemas Zod e os utilitários de dinheiro e data ficam em `packages/shared`, consumidos direto do código-fonte TypeScript. As dependências externas (verificador de JWT, admin do Supabase Auth e relógio) são injetadas em `createApp(deps)` para os testes serem determinísticos.

**Tech Stack:** Node 22, TypeScript 6.0.3, Express 5, Zod 4, Prisma 7.10.1 (`prisma-client` + `@prisma/adapter-pg`), PostgreSQL 17 (Docker), jose (JWT/JWKS), pino/pino-http, helmet, cors, express-rate-limit, @supabase/supabase-js (somente o admin), Vitest 5 + Supertest, ESLint 10 + typescript-eslint.

**Spec:** `docs/superpowers/specs/2026-11-11-fincontrol-fundacao-fluxo-caixa-design.md`

**Partes do SP1:** esta é a **Parte 1 (API)**. A Parte 2 (Web: design system, telas e PWA) e a Parte 3 (E2E, deploy na Vercel/Supabase e README de vitrine) são planos separados, escritos depois que esta parte estiver verde.

## Global Constraints

- Node `>=22`. TypeScript **6.0.3**, porque o typescript-eslint exige `<6.1`. Prisma **7.10.1**, a última estável; a 8 ainda é RC.
- Gerenciador de pacotes: **npm workspaces**. O pnpm não está instalado na máquina, e isso foi registrado na spec (D6).
- Dinheiro sempre em **centavos inteiros**: `BIGINT` no banco, `number` no TypeScript. Os valores são sempre positivos; o sinal vem do tipo. O limite é `MAX_CENTS = 100_000_000_000` (R$ 1 bilhão).
- Datas de negócio são strings `YYYY-MM-DD` (`DateOnly`). O "hoje" é sempre calculado no fuso `America/Sao_Paulo`.
- Base das rotas: `/api/v1`. Erros em `application/problem+json`: `{ type, title, status, detail, errors? }`.
- O `userId` vem **só** do `sub` do JWT. Recurso de outro usuário → **404**.
- Textos para o usuário em português do Brasil, com acentuação correta.
- Postgres local na porta **5435** (a 5433 já é usada por outro projeto). Bancos: `fincontrol_dev` e `fincontrol_test`.
- Commits em conventional commits, em português. Rode os comandos git de dentro de `FinControl/`, que tem repositório próprio.
- Toda tarefa termina com `npm run lint`, `npm run typecheck` e `npm test` verdes.

## Review Focus

1. **Primeiras requisições simultâneas de um usuário novo** (o front dispara várias ao abrir o dashboard). Devem responder 200 e provisionar exatamente 14 categorias, sem 500. Teste: Task 6.
2. **Duas listagens simultâneas do mesmo período** com recorrência ativa. Não podem duplicar ocorrências. Teste: Task 12.
3. **Categoria usada apenas pelo template de uma recorrência**, sem lançamentos. A exclusão sem `reassignTo` deve dar 409, não 500 de FK. Teste: Task 10.
4. **Conta arquivada referenciada por uma recorrência ativa.** A materialização não pode gerar novas ocorrências nela. Teste: Task 12.
5. **Descrição só com espaços ou valor com casas decimais** (ex.: `10.5`). Deve dar 400 com o campo indicado, nunca gravar. Teste: Task 11.

---

### Task 1: Monorepo + utilitários de dinheiro (`packages/shared`)

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `eslint.config.js`, `.gitignore`, `.nvmrc`, `docker-compose.yml`, `docker/init-test-db.sql`, `.github/workflows/ci.yml`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/index.ts`, `packages/shared/src/money.ts`
- Test: `packages/shared/src/money.test.ts`

**Interfaces:**
- Produces: `formatBRL(cents: number): string`, `parseBRLToCents(input: string): number | null`, `MAX_CENTS: number`, exportados por `@fincontrol/shared`.

- [ ] **Step 1: Criar a raiz do monorepo**

`package.json`:
```json
{
  "name": "fincontrol",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "apps/*"],
  "engines": { "node": ">=22" },
  "scripts": {
    "lint": "eslint .",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "db:up": "docker compose up -d --wait db"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "preserve",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": []
  }
}
```

`eslint.config.js`:
```js
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/generated/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
```

`.gitignore`:
```
node_modules/
dist/
coverage/
.env
.env.local
apps/api/src/generated/
*.log
playwright-report/
test-results/
```

`.nvmrc`:
```
22
```

`docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: fincontrol
      POSTGRES_PASSWORD: fincontrol
      POSTGRES_DB: fincontrol_dev
    ports:
      - "5435:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/init-test-db.sql:/docker-entrypoint-initdb.d/init-test-db.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U fincontrol -d fincontrol_dev"]
      interval: 2s
      timeout: 3s
      retries: 20
volumes:
  pgdata:
```

`docker/init-test-db.sql`:
```sql
CREATE DATABASE fincontrol_test;
```

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
```

- [ ] **Step 2: Criar o pacote `shared` e instalar as ferramentas**

`packages/shared/package.json`:
```json
{
  "name": "@fincontrol/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json",
    "test": "vitest run"
  }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

`packages/shared/src/index.ts`:
```ts
export * from './money';
```

Run:
```bash
npm install -D typescript@6.0.3 eslint @eslint/js typescript-eslint globals vitest
npm install -w @fincontrol/shared zod@4
```
Expected: `package-lock.json` criado, sem erros de peer dependency.

- [ ] **Step 3: Escrever o teste que falha**

`packages/shared/src/money.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatBRL, parseBRLToCents } from './money';

const plain = (s: string) => s.replace(/ /g, ' ');

describe('formatBRL', () => {
  it('formata centavos em reais no padrão pt-BR', () => {
    expect(plain(formatBRL(123456))).toBe('R$ 1.234,56');
    expect(plain(formatBRL(0))).toBe('R$ 0,00');
    expect(plain(formatBRL(5))).toBe('R$ 0,05');
  });

  it('formata valores negativos', () => {
    expect(plain(formatBRL(-1050))).toBe('-R$ 10,50');
  });
});

describe('parseBRLToCents', () => {
  it.each([
    ['1.234,56', 123456],
    ['R$ 12,3', 1230],
    ['10', 1000],
    ['0,05', 5],
    ['-0,50', -50],
    ['1.000.000', 100000000],
  ])('converte %s em %i centavos', (input, expected) => {
    expect(parseBRLToCents(input)).toBe(expected);
  });

  it.each(['', 'abc', '1,234', '1.23,00', '12,345', '1..0'])('rejeita %s', (input) => {
    expect(parseBRLToCents(input)).toBeNull();
  });
});
```

- [ ] **Step 4: Rodar e confirmar que falha**

Run: `npm test -w @fincontrol/shared`
Expected: FAIL, porque `./money` ainda não existe.

- [ ] **Step 5: Implementar**

`packages/shared/src/money.ts`:
```ts
/** Limite de qualquer valor monetário: R$ 1 bilhão, em centavos. */
export const MAX_CENTS = 100_000_000_000;

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

const WITH_THOUSANDS = /^-?\d{1,3}(\.\d{3})+(,\d{1,2})?$/;
const PLAIN = /^-?\d+(,\d{1,2})?$/;

/** Converte texto digitado em pt-BR ("1.234,56", "R$ 12,3") para centavos. */
export function parseBRLToCents(input: string): number | null {
  const cleaned = input.replace(/R\$/g, '').replace(/\s/g, '');
  if (!WITH_THOUSANDS.test(cleaned) && !PLAIN.test(cleaned)) return null;

  const negative = cleaned.startsWith('-');
  const [intPart = '0', decPart = ''] = cleaned.replace('-', '').replace(/\./g, '').split(',');
  const cents = Number(intPart) * 100 + Number(decPart.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}
```

- [ ] **Step 6: Rodar os testes, o lint e o typecheck**

Run: `npm test -w @fincontrol/shared && npm run lint && npm run typecheck`
Expected: PASS em tudo.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.base.json eslint.config.js .gitignore .nvmrc docker-compose.yml docker .github packages
git commit -m "chore: monorepo npm workspaces e utilitários de dinheiro em centavos"
```

---

### Task 2: Utilitários de data (`DateOnly`, fuso de São Paulo)

**Files:**
- Create: `packages/shared/src/dates.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/dates.test.ts`

**Interfaces:**
- Produces (todos com `type DateOnly = string`, no formato `YYYY-MM-DD`, e `type YearMonth = string`, no formato `YYYY-MM`):
  - `todayInSaoPaulo(now?: Date): DateOnly`
  - `isValidDateOnly(s: string): boolean`
  - `addDays(d: DateOnly, n: number): DateOnly`
  - `daysInMonth(year: number, month1: number): number`
  - `monthOf(d: DateOnly): YearMonth`
  - `startOfMonth(ym: YearMonth): DateOnly`
  - `endOfMonth(ym: YearMonth): DateOnly`
  - `addMonthsToYm(ym: YearMonth, n: number): YearMonth`
  - `dateInMonth(ym: YearMonth, day: number): DateOnly` (limita o dia ao último dia do mês)
  - `minDate(a: DateOnly, b: DateOnly): DateOnly`
  - `maxDate(a: DateOnly, b: DateOnly): DateOnly`

- [ ] **Step 1: Escrever o teste que falha**

`packages/shared/src/dates.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  addDays, addMonthsToYm, dateInMonth, daysInMonth, endOfMonth, isValidDateOnly,
  maxDate, minDate, monthOf, startOfMonth, todayInSaoPaulo,
} from './dates';

describe('todayInSaoPaulo', () => {
  it('usa o fuso de São Paulo, não o UTC', () => {
    expect(todayInSaoPaulo(new Date('2026-11-11T02:30:00Z'))).toBe('2026-11-10');
    expect(todayInSaoPaulo(new Date('2026-11-11T15:00:00Z'))).toBe('2026-11-11');
  });
});

describe('isValidDateOnly', () => {
  it.each(['2026-02-28', '2028-02-29'])('aceita %s', (d) => expect(isValidDateOnly(d)).toBe(true));
  it.each(['2026-02-30', '2026-13-01', '26-01-01', '2026-1-1', ''])('rejeita %s', (d) =>
    expect(isValidDateOnly(d)).toBe(false));
});

describe('aritmética de datas', () => {
  it('soma dias atravessando meses e anos bissextos', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('calcula início e fim de mês', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(startOfMonth('2026-11')).toBe('2026-11-01');
    expect(endOfMonth('2026-02')).toBe('2026-02-28');
    expect(endOfMonth('2026-12')).toBe('2026-12-31');
    expect(monthOf('2026-11-11')).toBe('2026-11');
  });

  it('soma meses a um ano-mês', () => {
    expect(addMonthsToYm('2026-11', 3)).toBe('2027-02');
    expect(addMonthsToYm('2026-01', -1)).toBe('2025-12');
    expect(addMonthsToYm('2026-06', -18)).toBe('2024-12');
  });

  it('limita o dia ao último dia do mês', () => {
    expect(dateInMonth('2026-02', 31)).toBe('2026-02-28');
    expect(dateInMonth('2026-04', 31)).toBe('2026-04-30');
    expect(dateInMonth('2026-05', 5)).toBe('2026-05-05');
  });

  it('compara datas', () => {
    expect(minDate('2026-01-02', '2026-01-01')).toBe('2026-01-01');
    expect(maxDate('2026-01-02', '2026-01-01')).toBe('2026-01-02');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @fincontrol/shared`
Expected: FAIL, porque `./dates` não existe.

- [ ] **Step 3: Implementar**

`packages/shared/src/dates.ts`:
```ts
/** Data de negócio sem hora, no formato YYYY-MM-DD. */
export type DateOnly = string;
/** Ano-mês no formato YYYY-MM. */
export type YearMonth = string;

export const TIME_ZONE = 'America/Sao_Paulo';

const todayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

const pad2 = (n: number) => String(n).padStart(2, '0');
const toUTC = (d: DateOnly) => new Date(`${d}T00:00:00.000Z`);
const fromUTC = (d: Date): DateOnly => d.toISOString().slice(0, 10);

function parseYm(ym: YearMonth): [number, number] {
  return [Number(ym.slice(0, 4)), Number(ym.slice(5, 7))];
}

export function todayInSaoPaulo(now: Date = new Date()): DateOnly {
  return todayFormatter.format(now);
}

export function isValidDateOnly(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = toUTC(s);
  return !Number.isNaN(d.getTime()) && fromUTC(d) === s;
}

export function addDays(d: DateOnly, n: number): DateOnly {
  const x = toUTC(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fromUTC(x);
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

export function monthOf(d: DateOnly): YearMonth {
  return d.slice(0, 7);
}

export function startOfMonth(ym: YearMonth): DateOnly {
  return `${ym}-01`;
}

export function endOfMonth(ym: YearMonth): DateOnly {
  const [y, m] = parseYm(ym);
  return `${ym}-${pad2(daysInMonth(y, m))}`;
}

export function addMonthsToYm(ym: YearMonth, n: number): YearMonth {
  const [y, m] = parseYm(ym);
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${pad2((index % 12) + 1)}`;
}

export function dateInMonth(ym: YearMonth, day: number): DateOnly {
  const [y, m] = parseYm(ym);
  return `${ym}-${pad2(Math.min(day, daysInMonth(y, m)))}`;
}

export function minDate(a: DateOnly, b: DateOnly): DateOnly {
  return a < b ? a : b;
}

export function maxDate(a: DateOnly, b: DateOnly): DateOnly {
  return a > b ? a : b;
}
```

`packages/shared/src/index.ts`:
```ts
export * from './money';
export * from './dates';
```

- [ ] **Step 4: Rodar os testes**

Run: `npm test -w @fincontrol/shared && npm run lint && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): utilitários de data sem hora no fuso de São Paulo"
```

---

### Task 3: Schemas Zod compartilhados

**Files:**
- Create: `packages/shared/src/schemas/common.ts`, `accounts.ts`, `categories.ts`, `transactions.ts`, `dashboard.ts`, `profile.ts`, `problem.ts`, `index.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/schemas/schemas.test.ts`

**Interfaces:**
- Produces: os schemas abaixo, com os tipos de entrada `z.output<...>` e os DTOs de saída.
  - `idSchema`, `dateOnlySchema`, `yearMonthSchema`, `centsSchema`, `colorSchema`, `nameSchema`
  - `accountTypeSchema`, `createAccountSchema`, `updateAccountSchema`, `listAccountsQuerySchema`, os tipos `AccountType`, `CreateAccountInput`, `UpdateAccountInput` e `AccountDTO`
  - `categoryTypeSchema`, `createCategorySchema`, `updateCategorySchema`, `listCategoriesQuerySchema`, `deleteCategoryQuerySchema`, os tipos `CategoryType`, `CreateCategoryInput`, `UpdateCategoryInput` e `CategoryDTO`
  - `transactionTypeSchema`, `natureSchema`, `statusSchema`, `frequencySchema`, `scopeQuerySchema`, `createTransactionSchema`, `updateTransactionSchema`, `listTransactionsQuerySchema`, `paySchema`, `transactionShapeIssues(t: ShapeInput): FieldIssue[]`, e os tipos `TransactionType`, `TransactionNature`, `TransactionStatus`, `Frequency`, `Scope`, `ShapeInput`, `FieldIssue`, `CreateTransactionInput`, `UpdateTransactionInput`, `ListTransactionsQuery`, `TransactionDTO` e `TransactionPage`
  - `summaryQuerySchema`, `evolutionQuerySchema`, `byCategoryQuerySchema`, os tipos `DashboardSummaryDTO`, `EvolutionPointDTO` e `CategorySpendDTO`
  - `updateProfileSchema`, os tipos `ThemePreference`, `UpdateProfileInput` e `ProfileDTO`
  - o tipo `ProblemDTO`

- [ ] **Step 1: Escrever o teste que falha**

`packages/shared/src/schemas/schemas.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  centsSchema, createAccountSchema, createTransactionSchema, listTransactionsQuerySchema,
  updateAccountSchema, updateTransactionSchema,
} from './index';

const ACC = '0b9f6f3a-1d2e-4c5b-8a7f-111111111111';
const ACC2 = '0b9f6f3a-1d2e-4c5b-8a7f-222222222222';
const CAT = '0b9f6f3a-1d2e-4c5b-8a7f-333333333333';

const expense = {
  type: 'expense', amount: 1990, description: 'Mercado', accountId: ACC,
  categoryId: CAT, nature: 'variable', dueDate: '2026-11-10',
};

const paths = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  r.error?.issues.map((i) => i.path.join('.')) ?? [];

describe('centsSchema', () => {
  it('aceita só inteiros positivos dentro do limite', () => {
    expect(centsSchema.safeParse(1).success).toBe(true);
    expect(centsSchema.safeParse(0).success).toBe(false);
    expect(centsSchema.safeParse(10.5).success).toBe(false);
    expect(centsSchema.safeParse('100').success).toBe(false);
    expect(centsSchema.safeParse(100_000_000_001).success).toBe(false);
  });
});

describe('createAccountSchema / updateAccountSchema', () => {
  it('aplica saldo inicial 0 por padrão e apara o nome', () => {
    const r = createAccountSchema.parse({ name: '  Nubank ', type: 'checking', color: '#8b5cf6' });
    expect(r).toEqual({ name: 'Nubank', type: 'checking', color: '#8b5cf6', initialBalance: 0 });
  });

  it('não injeta saldo inicial no PATCH e rejeita corpo vazio', () => {
    expect(updateAccountSchema.parse({ name: 'X' })).toEqual({ name: 'X' });
    expect(updateAccountSchema.safeParse({}).success).toBe(false);
  });

  it('rejeita cor inválida', () => {
    expect(paths(createAccountSchema.safeParse({ name: 'A', type: 'wallet', color: 'red' }))).toContain('color');
  });
});

describe('createTransactionSchema', () => {
  it('aceita despesa válida e aplica os padrões', () => {
    const r = createTransactionSchema.parse(expense);
    expect(r).toMatchObject({ status: 'pending', paidDate: null, destinationAccountId: null, recurrence: null });
  });

  it('exige categoria e natureza em receita/despesa', () => {
    const r = createTransactionSchema.safeParse({ ...expense, categoryId: null, nature: null });
    expect(paths(r)).toEqual(expect.arrayContaining(['categoryId', 'nature']));
  });

  it('exige destino diferente da origem em transferência e proíbe categoria', () => {
    const base = { type: 'transfer', amount: 100, description: 'Reserva', accountId: ACC, dueDate: '2026-11-10' };
    expect(paths(createTransactionSchema.safeParse(base))).toContain('destinationAccountId');
    expect(paths(createTransactionSchema.safeParse({ ...base, destinationAccountId: ACC }))).toContain('destinationAccountId');
    expect(paths(createTransactionSchema.safeParse({ ...base, destinationAccountId: ACC2, categoryId: CAT }))).toContain('categoryId');
    expect(createTransactionSchema.safeParse({ ...base, destinationAccountId: ACC2 }).success).toBe(true);
  });

  it('rejeita descrição só com espaços', () => {
    expect(paths(createTransactionSchema.safeParse({ ...expense, description: '   ' }))).toContain('description');
  });

  it('rejeita fim de recorrência antes do vencimento', () => {
    const r = createTransactionSchema.safeParse({ ...expense, recurrence: { frequency: 'monthly', endDate: '2026-11-01' } });
    expect(paths(r)).toContain('recurrence.endDate');
  });
});

describe('updateTransactionSchema', () => {
  it('rejeita corpo vazio', () => {
    expect(updateTransactionSchema.safeParse({}).success).toBe(false);
  });
});

describe('listTransactionsQuerySchema', () => {
  it('converte limit da querystring e aplica o padrão 50', () => {
    expect(listTransactionsQuerySchema.parse({}).limit).toBe(50);
    expect(listTransactionsQuerySchema.parse({ limit: '10' }).limit).toBe(10);
    expect(listTransactionsQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });

  it('rejeita período invertido', () => {
    expect(listTransactionsQuerySchema.safeParse({ from: '2026-12-01', to: '2026-11-01' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @fincontrol/shared`
Expected: FAIL, porque `./index` dos schemas não existe.

- [ ] **Step 3: Implementar os schemas**

`packages/shared/src/schemas/common.ts`:
```ts
import { z } from 'zod';
import { isValidDateOnly } from '../dates';
import { MAX_CENTS } from '../money';

export const idSchema = z.uuid('Identificador inválido');
export const dateOnlySchema = z.string().refine(isValidDateOnly, 'Data inválida (use AAAA-MM-DD)');
export const yearMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês inválido (use AAAA-MM)');
export const centsSchema = z
  .number('Informe um número')
  .int('Valor deve ser em centavos (inteiro)')
  .positive('Valor deve ser maior que zero')
  .max(MAX_CENTS, 'Valor acima do limite');
export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida (use #RRGGBB)');
export const nameSchema = z.string().trim().min(1, 'Obrigatório').max(60, 'Máximo de 60 caracteres');

export const nonEmpty = (o: object) => Object.keys(o).length > 0;
export const NON_EMPTY_MESSAGE = 'Nada para atualizar';
```

`packages/shared/src/schemas/accounts.ts`:
```ts
import { z } from 'zod';
import { MAX_CENTS } from '../money';
import { colorSchema, nameSchema, NON_EMPTY_MESSAGE, nonEmpty } from './common';

export const accountTypeSchema = z.enum(['checking', 'savings', 'wallet', 'investment']);
export type AccountType = z.infer<typeof accountTypeSchema>;

const initialBalanceSchema = z.number().int('Valor deve ser em centavos (inteiro)').min(-MAX_CENTS).max(MAX_CENTS);
const fields = { name: nameSchema, type: accountTypeSchema, color: colorSchema, initialBalance: initialBalanceSchema };

export const createAccountSchema = z.object({ ...fields, initialBalance: initialBalanceSchema.default(0) });
export const updateAccountSchema = z.object(fields).partial().refine(nonEmpty, NON_EMPTY_MESSAGE);
export const listAccountsQuerySchema = z.object({
  includeArchived: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
});

export type CreateAccountInput = z.output<typeof createAccountSchema>;
export type UpdateAccountInput = z.output<typeof updateAccountSchema>;

export type AccountDTO = {
  id: string;
  name: string;
  type: AccountType;
  color: string;
  initialBalance: number;
  balance: number;
  archivedAt: string | null;
  createdAt: string;
};
```

`packages/shared/src/schemas/categories.ts`:
```ts
import { z } from 'zod';
import { colorSchema, idSchema, nameSchema, NON_EMPTY_MESSAGE, nonEmpty } from './common';

export const categoryTypeSchema = z.enum(['income', 'expense']);
export type CategoryType = z.infer<typeof categoryTypeSchema>;

const iconSchema = z.string().trim().min(1, 'Obrigatório').max(40);

export const createCategorySchema = z.object({ name: nameSchema, type: categoryTypeSchema, icon: iconSchema, color: colorSchema });
export const updateCategorySchema = z
  .object({ name: nameSchema, icon: iconSchema, color: colorSchema })
  .partial()
  .refine(nonEmpty, NON_EMPTY_MESSAGE);
export const listCategoriesQuerySchema = z.object({ type: categoryTypeSchema.optional() });
export const deleteCategoryQuerySchema = z.object({ reassignTo: idSchema.optional() });

export type CreateCategoryInput = z.output<typeof createCategorySchema>;
export type UpdateCategoryInput = z.output<typeof updateCategorySchema>;

export type CategoryDTO = { id: string; name: string; type: CategoryType; icon: string; color: string };
```

`packages/shared/src/schemas/transactions.ts`:
```ts
import { z } from 'zod';
import { centsSchema, dateOnlySchema, idSchema, NON_EMPTY_MESSAGE, nonEmpty } from './common';

export const transactionTypeSchema = z.enum(['income', 'expense', 'transfer']);
export const natureSchema = z.enum(['fixed', 'variable']);
export const statusSchema = z.enum(['pending', 'paid']);
export const frequencySchema = z.enum(['weekly', 'monthly', 'yearly']);
export const scopeQuerySchema = z.object({ scope: z.enum(['single', 'future']).default('single') });

export type TransactionType = z.infer<typeof transactionTypeSchema>;
export type TransactionNature = z.infer<typeof natureSchema>;
export type TransactionStatus = z.infer<typeof statusSchema>;
export type Frequency = z.infer<typeof frequencySchema>;
export type Scope = z.output<typeof scopeQuerySchema>['scope'];

export type FieldIssue = { path: string; message: string };
export type ShapeInput = {
  type: TransactionType;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  nature: TransactionNature | null;
};

/** Regras de forma que dependem do tipo. É usada no schema e, no PATCH, pelo service, sobre o objeto mesclado. */
export function transactionShapeIssues(t: ShapeInput): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if (t.type === 'transfer') {
    if (!t.destinationAccountId) issues.push({ path: 'destinationAccountId', message: 'Informe a conta de destino' });
    else if (t.destinationAccountId === t.accountId)
      issues.push({ path: 'destinationAccountId', message: 'A conta de destino deve ser diferente da origem' });
    if (t.categoryId) issues.push({ path: 'categoryId', message: 'Transferência não tem categoria' });
    if (t.nature) issues.push({ path: 'nature', message: 'Transferência não tem natureza' });
  } else {
    if (!t.categoryId) issues.push({ path: 'categoryId', message: 'Informe a categoria' });
    if (!t.nature) issues.push({ path: 'nature', message: 'Informe se é fixa ou variável' });
    if (t.destinationAccountId) issues.push({ path: 'destinationAccountId', message: 'Só transferências têm conta de destino' });
  }
  return issues;
}

const descriptionSchema = z.string().trim().min(1, 'Obrigatório').max(120, 'Máximo de 120 caracteres');
const recurrenceSchema = z.object({ frequency: frequencySchema, endDate: dateOnlySchema.nullable().default(null) });

export const createTransactionSchema = z
  .object({
    type: transactionTypeSchema,
    amount: centsSchema,
    description: descriptionSchema,
    accountId: idSchema,
    destinationAccountId: idSchema.nullable().default(null),
    categoryId: idSchema.nullable().default(null),
    nature: natureSchema.nullable().default(null),
    status: statusSchema.default('pending'),
    dueDate: dateOnlySchema,
    paidDate: dateOnlySchema.nullable().default(null),
    recurrence: recurrenceSchema.nullable().default(null),
  })
  .superRefine((v, ctx) => {
    for (const issue of transactionShapeIssues(v)) ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
    if (v.recurrence?.endDate && v.recurrence.endDate < v.dueDate)
      ctx.addIssue({ code: 'custom', path: ['recurrence', 'endDate'], message: 'O fim da recorrência deve ser depois do vencimento' });
  });

export const updateTransactionSchema = z
  .object({
    amount: centsSchema,
    description: descriptionSchema,
    accountId: idSchema,
    destinationAccountId: idSchema.nullable(),
    categoryId: idSchema.nullable(),
    nature: natureSchema.nullable(),
    dueDate: dateOnlySchema,
    recurrence: recurrenceSchema,
  })
  .partial()
  .refine(nonEmpty, NON_EMPTY_MESSAGE);

export const listTransactionsQuerySchema = z
  .object({
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
    accountId: idSchema.optional(),
    categoryId: idSchema.optional(),
    type: transactionTypeSchema.optional(),
    status: statusSchema.optional(),
    q: z.string().trim().min(1).max(100).optional(),
    cursor: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, { path: ['to'], message: 'O fim do período deve ser depois do início' });

export const paySchema = z.object({ paidDate: dateOnlySchema.optional() });

export type CreateTransactionInput = z.output<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.output<typeof updateTransactionSchema>;
export type ListTransactionsQuery = z.output<typeof listTransactionsQuerySchema>;

export type TransactionDTO = {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  nature: TransactionNature | null;
  status: TransactionStatus;
  dueDate: string;
  paidDate: string | null;
  recurrenceId: string | null;
  occurrenceDate: string | null;
  overdue: boolean;
  createdAt: string;
};

export type TransactionPage = { items: TransactionDTO[]; nextCursor: string | null };
```

`packages/shared/src/schemas/dashboard.ts`:
```ts
import { z } from 'zod';
import { yearMonthSchema } from './common';
import type { TransactionDTO } from './transactions';

export const summaryQuerySchema = z.object({ month: yearMonthSchema.optional() });
export const byCategoryQuerySchema = z.object({ month: yearMonthSchema.optional() });
export const evolutionQuerySchema = z.object({ months: z.coerce.number().int().min(1).max(12).default(6) });

export type MonthComparison = { current: number; previous: number; changePercent: number | null };

export type DashboardSummaryDTO = {
  month: string;
  totalBalance: number;
  forecastEndOfMonth: number;
  income: MonthComparison;
  expense: MonthComparison;
  pendingCount: number;
  overdueCount: number;
  upcoming: TransactionDTO[];
};

export type EvolutionPointDTO = { month: string; income: number; expense: number; endBalance: number };
export type CategorySpendDTO = { categoryId: string; name: string; icon: string; color: string; total: number };
```

`packages/shared/src/schemas/profile.ts`:
```ts
import { z } from 'zod';
import { NON_EMPTY_MESSAGE, nonEmpty } from './common';

export const themeSchema = z.enum(['light', 'dark', 'system']);
export type ThemePreference = z.infer<typeof themeSchema>;

export const updateProfileSchema = z
  .object({ name: z.string().trim().min(1, 'Obrigatório').max(80, 'Máximo de 80 caracteres'), theme: themeSchema })
  .partial()
  .refine(nonEmpty, NON_EMPTY_MESSAGE);

export type UpdateProfileInput = z.output<typeof updateProfileSchema>;

export type ProfileDTO = { id: string; name: string; email: string | null; isDemo: boolean; theme: ThemePreference };
```

`packages/shared/src/schemas/problem.ts`:
```ts
export type ProblemDTO = {
  type: string;
  title: string;
  status: number;
  detail: string;
  errors?: { path: string; message: string }[];
};
```

`packages/shared/src/schemas/index.ts`:
```ts
export * from './common';
export * from './accounts';
export * from './categories';
export * from './transactions';
export * from './dashboard';
export * from './profile';
export * from './problem';
```

`packages/shared/src/index.ts`:
```ts
export * from './money';
export * from './dates';
export * from './schemas';
```

- [ ] **Step 4: Rodar os testes**

Run: `npm test -w @fincontrol/shared && npm run lint && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): schemas Zod e DTOs de contas, categorias, lançamentos, dashboard e perfil"
```

---

### Task 4: Esqueleto da API (configuração, logs, erros problem+json e health)

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/api/.env.test`, `apps/api/.env.example`
- Create: `apps/api/src/config/env.ts`, `apps/api/src/infra/logger.ts`, `apps/api/src/http/errors.ts`, `apps/api/src/http/validate.ts`, `apps/api/src/http/problem.ts`, `apps/api/src/http/request-logger.ts`, `apps/api/src/http/app.ts`, `apps/api/src/server.ts`
- Create: `apps/api/test/setup-env.ts`, `apps/api/test/helpers/app.ts`
- Test: `apps/api/test/app.test.ts`, `apps/api/src/config/env.test.ts`

**Interfaces:**
- Consumes: nada do domínio ainda.
- Produces:
  - `loadConfig(env?: NodeJS.ProcessEnv): AppConfig`
  - `createLogger(level: string): Logger`
  - Erros: `AppError(status, title, detail?, errors?)`, `ValidationError(errors: FieldError[])`, `UnauthorizedError()`, `ForbiddenError(detail)`, `NotFoundError(resource)`, `ConflictError(detail)`, `UnprocessableError(detail)`
  - `parse<T extends z.ZodType>(schema: T, data: unknown): z.output<T>`
  - `errorHandler(logger)`, `notFoundHandler`, `tooManyRequests`
  - `createApp(deps: AppDeps): Express` (nesta tarefa `AppDeps = { config; logger }`; a Task 6 amplia)
  - Helper de teste `buildTestApp()`

- [ ] **Step 1: Criar o pacote e instalar as dependências**

`apps/api/package.json`:
```json
{
  "name": "@fincontrol/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch --env-file=.env src/server.ts",
    "typecheck": "tsc -p tsconfig.json",
    "test": "vitest run"
  }
}
```

`apps/api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "test", "vitest.config.ts", "prisma.config.ts"]
}
```

`apps/api/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./test/setup-env.ts'],
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 15_000,
  },
});
```

`apps/api/.env.test` (versionado; só tem valores locais do Docker, nenhum segredo real):
```
NODE_ENV=test
LOG_LEVEL=silent
DATABASE_URL=postgresql://fincontrol:fincontrol@localhost:5435/fincontrol_test
DIRECT_URL=postgresql://fincontrol:fincontrol@localhost:5435/fincontrol_test
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=test-service-role-key
WEB_ORIGIN=http://localhost:5173
CRON_SECRET=test-cron-secret-with-at-least-32-chars
```

`apps/api/.env.example`:
```
NODE_ENV=development
PORT=3333
LOG_LEVEL=info
# Local (docker compose). Em produção: string do pooler do Supabase.
DATABASE_URL=postgresql://fincontrol:fincontrol@localhost:5435/fincontrol_dev
# Conexão direta, usada pelas migrations do Prisma.
DIRECT_URL=postgresql://fincontrol:fincontrol@localhost:5435/fincontrol_dev
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=coloque-a-service-role-key
WEB_ORIGIN=http://localhost:5173
CRON_SECRET=gere-com-openssl-rand-hex-32
```

`apps/api/test/setup-env.ts`:
```ts
import { fileURLToPath } from 'node:url';

process.loadEnvFile(fileURLToPath(new URL('../.env.test', import.meta.url)));
```

Run:
```bash
npm install -w @fincontrol/api express cors helmet express-rate-limit pino pino-http zod@4 @fincontrol/shared
npm install -w @fincontrol/api -D @types/express @types/cors @types/node@22 supertest @types/supertest tsx vitest
```
Expected: instalado, com `@fincontrol/shared` linkado do workspace.

- [ ] **Step 2: Escrever os testes que falham**

`apps/api/src/config/env.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { loadConfig } from './env';

describe('loadConfig', () => {
  it('lê e valida as variáveis', () => {
    const config = loadConfig(process.env);
    expect(config.NODE_ENV).toBe('test');
    expect(config.PORT).toBe(3333);
  });

  it('falha nomeando as variáveis ausentes', () => {
    expect(() => loadConfig({ NODE_ENV: 'test' })).toThrow(/DATABASE_URL.*SUPABASE_URL/);
  });

  it('exige CRON_SECRET com pelo menos 32 caracteres', () => {
    expect(() => loadConfig({ ...process.env, CRON_SECRET: 'curto' })).toThrow(/CRON_SECRET/);
  });
});
```

`apps/api/test/helpers/app.ts`:
```ts
import { loadConfig } from '../../src/config/env';
import { createApp, type AppDeps } from '../../src/http/app';
import { createLogger } from '../../src/infra/logger';

export function buildTestApp(overrides: Partial<AppDeps> = {}) {
  const deps: AppDeps = { config: loadConfig(), logger: createLogger('silent'), ...overrides };
  return { app: createApp(deps), deps };
}
```

`apps/api/test/app.test.ts`:
```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/app';

const { app } = buildTestApp();

describe('infraestrutura HTTP', () => {
  it('GET /api/v1/health responde ok com X-Request-Id', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', version: '0.1.0' });
    expect(res.headers['x-request-id']).toMatch(/^[\w-]+$/);
  });

  it('reaproveita um X-Request-Id válido recebido', async () => {
    const res = await request(app).get('/api/v1/health').set('X-Request-Id', 'abc-123');
    expect(res.headers['x-request-id']).toBe('abc-123');
  });

  it('rota inexistente devolve 404 em problem+json', async () => {
    const res = await request(app).get('/nao-existe');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.body).toMatchObject({ status: 404, title: 'Rota não encontrada' });
  });

  it('JSON malformado devolve 400', async () => {
    const res = await request(app).post('/nao-existe').set('Content-Type', 'application/json').send('{"a":');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ status: 400, title: 'JSON inválido' });
  });

  it('aplica cabeçalhos de segurança e CORS restrito', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -w @fincontrol/api`
Expected: FAIL, porque os módulos `src/config/env` e `src/http/app` não existem.

- [ ] **Step 4: Implementar**

`apps/api/src/config/env.ts`:
```ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url(),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  WEB_ORIGIN: z.url(),
  CRON_SECRET: z.string().min(32),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => i.path.join('.')))].join(', ');
    throw new Error(`Variáveis de ambiente inválidas ou ausentes: ${fields}`);
  }
  return parsed.data;
}
```

`apps/api/src/infra/logger.ts`:
```ts
import { pino, type Logger } from 'pino';

export type { Logger };

export function createLogger(level: string): Logger {
  return pino({ level, redact: ['req.headers.authorization', 'req.headers.cookie'] });
}
```

`apps/api/src/http/errors.ts`:
```ts
export type FieldError = { path: string; message: string };

export class AppError extends Error {
  readonly status: number;
  readonly title: string;
  readonly errors: FieldError[] | undefined;

  constructor(status: number, title: string, detail?: string, errors?: FieldError[]) {
    super(detail ?? title);
    this.status = status;
    this.title = title;
    this.errors = errors;
  }
}

export class ValidationError extends AppError {
  constructor(errors: FieldError[]) {
    super(400, 'Dados inválidos', 'Um ou mais campos são inválidos.', errors);
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super(401, 'Não autenticado', 'Faça login para continuar.');
  }
}

export class ForbiddenError extends AppError {
  constructor(detail: string) {
    super(403, 'Acesso negado', detail);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, 'Não encontrado', `${resource} não encontrado(a).`);
  }
}

export class ConflictError extends AppError {
  constructor(detail: string) {
    super(409, 'Conflito', detail);
  }
}

export class UnprocessableError extends AppError {
  constructor(detail: string) {
    super(422, 'Regra de negócio violada', detail);
  }
}
```

`apps/api/src/http/validate.ts`:
```ts
import type { z } from 'zod';
import { ValidationError } from './errors';

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  return result.data;
}
```

`apps/api/src/http/problem.ts`:
```ts
import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import type { Logger } from '../infra/logger';
import { AppError } from './errors';

function sendProblem(res: Response, status: number, title: string, detail: string, errors?: unknown) {
  res
    .status(status)
    .type('application/problem+json')
    .json({ type: 'about:blank', title, status, detail, ...(errors ? { errors } : {}) });
}

function bodyParserType(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string') return err.type;
  return undefined;
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  sendProblem(res, 404, 'Rota não encontrada', 'O endereço solicitado não existe.');
};

export const tooManyRequests: RequestHandler = (_req, res) => {
  sendProblem(res, 429, 'Muitas requisições', 'Aguarde um pouco e tente novamente.');
};

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, _next) => {
    if (err instanceof AppError) {
      sendProblem(res, err.status, err.title, err.message, err.errors);
      return;
    }
    const parserType = bodyParserType(err);
    if (parserType === 'entity.parse.failed') {
      sendProblem(res, 400, 'JSON inválido', 'O corpo da requisição não é um JSON válido.');
      return;
    }
    if (parserType === 'entity.too.large') {
      sendProblem(res, 413, 'Corpo muito grande', 'O corpo da requisição excede o limite.');
      return;
    }
    logger.error({ err, requestId: req.id }, 'erro inesperado');
    sendProblem(res, 500, 'Erro interno', 'Algo deu errado. Tente novamente.');
  };
}
```

`apps/api/src/http/request-logger.ts`:
```ts
import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import type { Logger } from '../infra/logger';

const VALID_ID = /^[\w-]{1,64}$/;

export function requestLogger(logger: Logger) {
  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id = typeof incoming === 'string' && VALID_ID.test(incoming) ? incoming : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
  });
}
```

`apps/api/src/http/app.ts`:
```ts
import cors from 'cors';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import type { AppConfig } from '../config/env';
import type { Logger } from '../infra/logger';
import { errorHandler, notFoundHandler, tooManyRequests } from './problem';
import { requestLogger } from './request-logger';

export const API_VERSION = '0.1.0';

export type AppDeps = { config: AppConfig; logger: Logger };

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestLogger(deps.logger));
  app.use(helmet());
  app.use(cors({ origin: deps.config.WEB_ORIGIN }));
  app.use(express.json({ limit: '100kb' }));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: () => deps.config.NODE_ENV === 'test',
      handler: tooManyRequests,
    }),
  );

  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok', version: API_VERSION });
  });

  app.use(notFoundHandler);
  app.use(errorHandler(deps.logger));
  return app;
}
```

`apps/api/src/server.ts`:
```ts
import { loadConfig } from './config/env';
import { createApp } from './http/app';
import { createLogger } from './infra/logger';

const config = loadConfig();
const logger = createLogger(config.LOG_LEVEL);
const app = createApp({ config, logger });

app.listen(config.PORT, () => {
  logger.info(`API do FinControl ouvindo em http://localhost:${config.PORT}`);
});
```

- [ ] **Step 5: Rodar os testes**

Run: `npm test -w @fincontrol/api && npm run lint && npm run typecheck`
Expected: PASS (8 testes na API).

- [ ] **Step 6: Commit**

```bash
git add apps/api package.json package-lock.json
git commit -m "feat(api): esqueleto Express 5 com config validada, logs e erros problem+json"
```

---

### Task 5: Prisma, schema do banco, RLS e banco de testes

**Files:**
- Create: `apps/api/prisma/schema.prisma`, `apps/api/prisma.config.ts`, `apps/api/prisma/migrations/*` (gerado), `apps/api/.env` (local, não versionado)
- Create: `apps/api/src/infra/prisma.ts`, `apps/api/src/infra/date-mapping.ts`, `apps/api/src/infra/prisma-errors.ts`
- Create: `apps/api/test/global-setup.ts`, `apps/api/test/helpers/db.ts`
- Modify: `apps/api/package.json` (scripts), `apps/api/vitest.config.ts` (globalSetup), `.github/workflows/ci.yml` (serviço Postgres)
- Test: `apps/api/test/db.test.ts`, `apps/api/src/infra/date-mapping.test.ts`

**Interfaces:**
- Produces:
  - `type Db = PrismaClient`, `createPrisma(databaseUrl: string): Db`
  - `toDateOnly(d: Date): DateOnly`, `fromDateOnly(s: DateOnly): Date`
  - `isUniqueViolation(err: unknown): boolean`
  - Helpers de teste: `testDb: Db`, `resetDb(): Promise<void>`
  - Modelos Prisma: `profile`, `account`, `category`, `recurrence`, `recurrenceSkip`, `transaction`. As relações de `Transaction` se chamam `account`, `destinationAccount`, `category` e `recurrence`. As de `Recurrence` se chamam `account`, `destinationAccount` e `category`.

- [ ] **Step 1: Instalar o Prisma e subir o Postgres**

Run:
```bash
npm install -w @fincontrol/api @prisma/client@7.10.1 @prisma/adapter-pg@7.10.1 pg dotenv
npm install -w @fincontrol/api -D prisma@7.10.1 @types/pg
cp apps/api/.env.example apps/api/.env
npm run db:up
```
Expected: o container `db` fica com status healthy na porta 5435.

- [ ] **Step 2: Escrever o schema e a configuração do Prisma**

`apps/api/prisma.config.ts`:
```ts
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '' },
});
```

`apps/api/prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum ThemePreference {
  light
  dark
  system
}

enum AccountType {
  checking
  savings
  wallet
  investment
}

enum CategoryType {
  income
  expense
}

enum TransactionType {
  income
  expense
  transfer
}

enum TransactionNature {
  fixed
  variable
}

enum TransactionStatus {
  pending
  paid
}

enum Frequency {
  weekly
  monthly
  yearly
}

model Profile {
  id           String          @id @db.Uuid
  name         String
  isDemo       Boolean         @default(false) @map("is_demo")
  theme        ThemePreference @default(system)
  createdAt    DateTime        @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime        @updatedAt @map("updated_at") @db.Timestamptz
  accounts     Account[]
  categories   Category[]
  recurrences  Recurrence[]
  transactions Transaction[]

  @@index([isDemo, createdAt])
  @@map("profiles")
}

model Account {
  id                  String        @id @default(uuid()) @db.Uuid
  userId              String        @map("user_id") @db.Uuid
  name                String
  type                AccountType
  color               String
  initialBalance      BigInt        @default(0) @map("initial_balance")
  archivedAt          DateTime?     @map("archived_at") @db.Timestamptz
  createdAt           DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt           DateTime      @updatedAt @map("updated_at") @db.Timestamptz
  user                Profile       @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions        Transaction[] @relation("TransactionAccount")
  incomingTransfers   Transaction[] @relation("TransactionDestination")
  recurrences         Recurrence[]  @relation("RecurrenceAccount")
  incomingRecurrences Recurrence[]  @relation("RecurrenceDestination")

  @@index([userId])
  @@map("accounts")
}

model Category {
  id           String        @id @default(uuid()) @db.Uuid
  userId       String        @map("user_id") @db.Uuid
  name         String
  type         CategoryType
  icon         String
  color        String
  createdAt    DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime      @updatedAt @map("updated_at") @db.Timestamptz
  user         Profile       @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions Transaction[]
  recurrences  Recurrence[]

  @@unique([userId, type, name])
  @@map("categories")
}

model Recurrence {
  id                   String             @id @default(uuid()) @db.Uuid
  userId               String             @map("user_id") @db.Uuid
  frequency            Frequency
  startDate            DateTime           @map("start_date") @db.Date
  endDate              DateTime?          @map("end_date") @db.Date
  type                 TransactionType
  amount               BigInt
  description          String
  accountId            String             @map("account_id") @db.Uuid
  destinationAccountId String?            @map("destination_account_id") @db.Uuid
  categoryId           String?            @map("category_id") @db.Uuid
  nature               TransactionNature?
  createdAt            DateTime           @default(now()) @map("created_at") @db.Timestamptz
  updatedAt            DateTime           @updatedAt @map("updated_at") @db.Timestamptz
  user                 Profile            @relation(fields: [userId], references: [id], onDelete: Cascade)
  account              Account            @relation("RecurrenceAccount", fields: [accountId], references: [id], onDelete: NoAction)
  destinationAccount   Account?           @relation("RecurrenceDestination", fields: [destinationAccountId], references: [id], onDelete: NoAction)
  category             Category?          @relation(fields: [categoryId], references: [id], onDelete: NoAction)
  transactions         Transaction[]
  skips                RecurrenceSkip[]

  @@index([userId])
  @@map("recurrences")
}

model RecurrenceSkip {
  id             String     @id @default(uuid()) @db.Uuid
  recurrenceId   String     @map("recurrence_id") @db.Uuid
  occurrenceDate DateTime   @map("occurrence_date") @db.Date
  recurrence     Recurrence @relation(fields: [recurrenceId], references: [id], onDelete: Cascade)

  @@unique([recurrenceId, occurrenceDate])
  @@map("recurrence_skips")
}

model Transaction {
  id                   String             @id @default(uuid()) @db.Uuid
  userId               String             @map("user_id") @db.Uuid
  type                 TransactionType
  amount               BigInt
  description          String
  accountId            String             @map("account_id") @db.Uuid
  destinationAccountId String?            @map("destination_account_id") @db.Uuid
  categoryId           String?            @map("category_id") @db.Uuid
  nature               TransactionNature?
  status               TransactionStatus  @default(pending)
  dueDate              DateTime           @map("due_date") @db.Date
  paidDate             DateTime?          @map("paid_date") @db.Date
  recurrenceId         String?            @map("recurrence_id") @db.Uuid
  occurrenceDate       DateTime?          @map("occurrence_date") @db.Date
  createdAt            DateTime           @default(now()) @map("created_at") @db.Timestamptz
  updatedAt            DateTime           @updatedAt @map("updated_at") @db.Timestamptz
  user                 Profile            @relation(fields: [userId], references: [id], onDelete: Cascade)
  account              Account            @relation("TransactionAccount", fields: [accountId], references: [id], onDelete: NoAction)
  destinationAccount   Account?           @relation("TransactionDestination", fields: [destinationAccountId], references: [id], onDelete: NoAction)
  category             Category?          @relation(fields: [categoryId], references: [id], onDelete: NoAction)
  recurrence           Recurrence?        @relation(fields: [recurrenceId], references: [id], onDelete: SetNull)

  @@unique([recurrenceId, occurrenceDate])
  @@index([userId, dueDate])
  @@index([userId, paidDate])
  @@map("transactions")
}
```

> `onDelete: NoAction` (e não `Restrict`) nas FKs para conta e categoria: o Postgres só checa `NO ACTION` no fim do comando. Assim a cascata disparada pelo `DELETE` do perfil apaga contas e lançamentos no mesmo comando sem erro. Fora desse caso, a exclusão direta de uma conta com lançamentos continua bloqueada pela FK, e o service responde 409 antes disso.

- [ ] **Step 3: Gerar as migrations (estrutura + RLS e constraints)**

Run:
```bash
cd apps/api
npx prisma migrate dev --name init
npx prisma migrate dev --create-only --name rls_e_constraints
```

Coloque este conteúdo no arquivo `migration.sql` recém-criado em `apps/api/prisma/migrations/*_rls_e_constraints/`:
```sql
-- A API (dona das tabelas) ignora RLS. Os papéis anon/authenticated do Supabase
-- ficam sem nenhuma policy, ou seja, sem acesso pela API REST automática.
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recurrences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recurrence_skips" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_amount_positive" CHECK ("amount" > 0);
```

Run:
```bash
npx prisma migrate dev
cd ../..
```
Expected: as duas migrations são aplicadas em `fincontrol_dev` e o client é gerado em `apps/api/src/generated/prisma`.

- [ ] **Step 4: Configurar scripts, harness de teste e CI**

Em `apps/api/package.json`, troque o bloco `scripts` por:
```json
{
  "dev": "tsx watch --env-file=.env src/server.ts",
  "typecheck": "tsc -p tsconfig.json",
  "test": "vitest run",
  "db:migrate": "prisma migrate dev",
  "db:deploy": "prisma migrate deploy",
  "postinstall": "prisma generate"
}
```

`apps/api/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup-env.ts'],
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 15_000,
  },
});
```

`apps/api/test/global-setup.ts`:
```ts
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export default function setup() {
  const apiRoot = fileURLToPath(new URL('..', import.meta.url));
  process.loadEnvFile(fileURLToPath(new URL('../.env.test', import.meta.url)));
  execSync('npx prisma migrate deploy', { cwd: apiRoot, env: process.env, stdio: 'inherit' });
}
```

No `.github/workflows/ci.yml`, troque o job `check` por:
```yaml
  check:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: fincontrol
          POSTGRES_PASSWORD: fincontrol
          POSTGRES_DB: fincontrol_test
        ports:
          - 5435:5432
        options: >-
          --health-cmd "pg_isready -U fincontrol -d fincontrol_test"
          --health-interval 2s
          --health-timeout 3s
          --health-retries 20
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
```

- [ ] **Step 5: Escrever os testes que falham**

`apps/api/src/infra/date-mapping.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { fromDateOnly, toDateOnly } from './date-mapping';

describe('date-mapping', () => {
  it('ida e volta sem deslocar o dia', () => {
    expect(toDateOnly(fromDateOnly('2026-02-28'))).toBe('2026-02-28');
    expect(fromDateOnly('2026-11-11').toISOString()).toBe('2026-11-11T00:00:00.000Z');
  });
});
```

`apps/api/test/helpers/db.ts`:
```ts
import { createPrisma } from '../../src/infra/prisma';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL ausente no ambiente de teste');

export const testDb = createPrisma(url);

export async function resetDb(): Promise<void> {
  await testDb.$executeRawUnsafe(
    'TRUNCATE "transactions", "recurrence_skips", "recurrences", "categories", "accounts", "profiles" CASCADE',
  );
}
```

`apps/api/test/db.test.ts`:
```ts
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fromDateOnly, toDateOnly } from '../src/infra/date-mapping';
import { resetDb, testDb } from './helpers/db';

async function seedAccount() {
  const userId = randomUUID();
  await testDb.profile.create({ data: { id: userId, name: 'Ana' } });
  const account = await testDb.account.create({
    data: { userId, name: 'Corrente', type: 'checking', color: '#2563eb', initialBalance: 123456n },
  });
  return { userId, account };
}

describe('banco de dados', () => {
  beforeEach(resetDb);

  it('persiste centavos como BigInt e datas sem hora', async () => {
    const { userId, account } = await seedAccount();
    const tx = await testDb.transaction.create({
      data: { userId, type: 'expense', amount: 999n, description: 'Café', accountId: account.id, dueDate: fromDateOnly('2026-02-28') },
    });
    expect(account.initialBalance).toBe(123456n);
    expect(tx.amount).toBe(999n);
    expect(toDateOnly(tx.dueDate)).toBe('2026-02-28');
  });

  it('rejeita valor zero pela constraint', async () => {
    const { userId, account } = await seedAccount();
    await expect(
      testDb.transaction.create({
        data: { userId, type: 'expense', amount: 0n, description: 'X', accountId: account.id, dueDate: fromDateOnly('2026-01-01') },
      }),
    ).rejects.toThrow();
  });

  it('apaga tudo em cascata ao excluir o perfil', async () => {
    const { userId, account } = await seedAccount();
    await testDb.transaction.create({
      data: { userId, type: 'expense', amount: 10n, description: 'X', accountId: account.id, dueDate: fromDateOnly('2026-01-01') },
    });
    await testDb.profile.delete({ where: { id: userId } });
    expect(await testDb.account.count()).toBe(0);
    expect(await testDb.transaction.count()).toBe(0);
  });
});
```

- [ ] **Step 6: Rodar e confirmar que falha**

Run: `npm test -w @fincontrol/api`
Expected: FAIL, porque `src/infra/prisma` e `src/infra/date-mapping` não existem.

- [ ] **Step 7: Implementar a infra**

`apps/api/src/infra/prisma.ts`:
```ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

export type Db = PrismaClient;

export function createPrisma(databaseUrl: string): Db {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}
```

`apps/api/src/infra/date-mapping.ts`:
```ts
import type { DateOnly } from '@fincontrol/shared';

/** Colunas DATE chegam do Prisma como Date à meia-noite UTC. */
export const toDateOnly = (d: Date): DateOnly => d.toISOString().slice(0, 10);
export const fromDateOnly = (s: DateOnly): Date => new Date(`${s}T00:00:00.000Z`);
```

`apps/api/src/infra/prisma-errors.ts`:
```ts
import { Prisma } from '../generated/prisma/client';

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}
```

- [ ] **Step 8: Rodar os testes**

Run: `npm run db:up && npm test -w @fincontrol/api && npm run lint && npm run typecheck`
Expected: PASS. O global setup aplica as migrations em `fincontrol_test`.

- [ ] **Step 9: Commit**

```bash
git add apps/api .github package-lock.json
git commit -m "feat(api): schema Prisma com RLS fechado, constraints de valor e banco de testes"
```

---

<!-- CONTINUA-PARTE-B -->
