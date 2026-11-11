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

### Task 6: Autenticação (JWT do Supabase), provisionamento e `/me`

**Files:**
- Create: `apps/api/src/infra/token-verifier.ts`, `apps/api/src/infra/auth-admin.ts`, `apps/api/src/http/deps.ts`, `apps/api/src/http/auth.ts`, `apps/api/src/http/container.ts`, `apps/api/src/http/routes.ts`
- Create: `apps/api/src/modules/profile/default-categories.ts`, `provisioning.ts`, `profile.repository.ts`, `profile.service.ts`, `profile.routes.ts`
- Create: `apps/api/test/helpers/auth.ts`, `apps/api/test/helpers/fakes.ts`
- Modify: `apps/api/src/http/app.ts` (substituição completa), `apps/api/test/helpers/app.ts` (substituição completa), `apps/api/src/server.ts` (substituição completa)
- Test: `apps/api/test/auth-profile.test.ts`

**Interfaces:**
- Consumes: `Db`, `createPrisma`, `isUniqueViolation` e os erros da Task 4/5; `updateProfileSchema`, `idSchema`, `ProfileDTO`.
- Produces:
  - `type AuthClaims = { userId: string; isAnonymous: boolean; email: string | null; name: string | null }`
  - `interface TokenVerifier { verify(token: string): Promise<AuthClaims> }`, `createJwksVerifier({ getKey, issuer })`, `createSupabaseVerifier(supabaseUrl)`
  - `interface AuthAdmin { deleteUser(userId: string): Promise<void> }`, `createSupabaseAuthAdmin(url, serviceRoleKey)`
  - `type AppDeps = { config; logger; db: Db; verifier: TokenVerifier; authAdmin: AuthAdmin; clock: () => Date }`
  - `requireAuth(verifier)`, `authOf(res): AuthClaims`, `userIdOf(res): string`
  - `createProvisioner(db): Provisioner`, com `ensure(claims)` e `forget(userId)`
  - `ProfileService`, com `get(claims)`, `update(claims, input)` e `deleteAccount(userId)`
  - `buildContainer(deps)` e `registerRoutes(api, container)`. Cada tarefa seguinte acrescenta o seu módulo aos dois.
  - Helpers de teste: `FIXED_NOW` (2026-11-11 12:00 em São Paulo), `buildTestApp()`, `newUser({ isAnonymous?, name? })` → `{ id, auth }`, `tokenFor(...)`, `fakeAuthAdmin()`

- [ ] **Step 1: Instalar as dependências**

Run: `npm install -w @fincontrol/api jose @supabase/supabase-js`

- [ ] **Step 2: Escrever os helpers de teste**

`apps/api/test/helpers/auth.ts`:
```ts
import { randomUUID } from 'node:crypto';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createJwksVerifier } from '../../src/infra/token-verifier';

const ISSUER = 'http://localhost:54321/auth/v1';
const { publicKey, privateKey } = await generateKeyPair('ES256');
const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'ES256' };

export const testVerifier = createJwksVerifier({ getKey: createLocalJWKSet({ keys: [jwk] }), issuer: ISSUER });

type TokenOptions = { id: string; isAnonymous?: boolean; email?: string; name?: string; expiresIn?: string | number };

export async function tokenFor(opts: TokenOptions): Promise<string> {
  return new SignJWT({
    is_anonymous: opts.isAnonymous ?? false,
    email: opts.isAnonymous ? '' : (opts.email ?? 'teste@fincontrol.dev'),
    user_metadata: opts.name ? { full_name: opts.name } : {},
  })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setSubject(opts.id)
    .setIssuer(ISSUER)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? '1h')
    .sign(privateKey);
}

export async function newUser(opts: Omit<TokenOptions, 'id'> = {}) {
  const id = randomUUID();
  const token = await tokenFor({ id, ...opts });
  return { id, auth: { Authorization: `Bearer ${token}` } };
}

export type TestUser = Awaited<ReturnType<typeof newUser>>;
```

`apps/api/test/helpers/fakes.ts`:
```ts
import type { AuthAdmin } from '../../src/infra/auth-admin';

export function fakeAuthAdmin(): AuthAdmin & { deleted: string[] } {
  const deleted: string[] = [];
  return {
    deleted,
    async deleteUser(userId: string) {
      deleted.push(userId);
    },
  };
}
```

`apps/api/test/helpers/app.ts`:
```ts
import { loadConfig } from '../../src/config/env';
import { createApp } from '../../src/http/app';
import type { AppDeps } from '../../src/http/deps';
import { createLogger } from '../../src/infra/logger';
import { testVerifier } from './auth';
import { testDb } from './db';
import { fakeAuthAdmin } from './fakes';

/** 11/11/2026 12:00 em São Paulo. Todo "hoje" dos testes é 2026-11-11. */
export const FIXED_NOW = new Date('2026-11-11T15:00:00Z');

export function buildTestApp(overrides: Partial<AppDeps> = {}) {
  const authAdmin = fakeAuthAdmin();
  const deps: AppDeps = {
    config: loadConfig(),
    logger: createLogger('silent'),
    db: testDb,
    verifier: testVerifier,
    authAdmin,
    clock: () => FIXED_NOW,
    ...overrides,
  };
  return { app: createApp(deps), deps, authAdmin };
}
```

- [ ] **Step 3: Escrever o teste que falha**

`apps/api/test/auth-profile.test.ts`:
```ts
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { fromDateOnly } from '../src/infra/date-mapping';
import { buildTestApp } from './helpers/app';
import { newUser, tokenFor } from './helpers/auth';
import { resetDb, testDb } from './helpers/db';

const { app, authAdmin } = buildTestApp();

describe('autenticação', () => {
  beforeEach(resetDb);

  it('sem token devolve 401', async () => {
    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(401);
    expect(res.body.title).toBe('Não autenticado');
  });

  it('token inválido ou expirado devolve 401', async () => {
    const garbage = await request(app).get('/api/v1/me').set('Authorization', 'Bearer abc.def.ghi');
    expect(garbage.status).toBe(401);
    const expired = await tokenFor({ id: randomUUID(), expiresIn: Math.floor(Date.now() / 1000) - 60 });
    const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });
});

describe('provisionamento e /me', () => {
  beforeEach(resetDb);

  it('cria o perfil e as 14 categorias padrão no primeiro acesso, uma única vez', async () => {
    const user = await newUser({ name: 'Ana Souza', email: 'ana@exemplo.com' });
    const first = await request(app).get('/api/v1/me').set(user.auth);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ id: user.id, name: 'Ana Souza', email: 'ana@exemplo.com', isDemo: false, theme: 'system' });
    await request(app).get('/api/v1/me').set(user.auth);
    expect(await testDb.category.count({ where: { userId: user.id } })).toBe(14);
    expect(await testDb.category.count({ where: { userId: user.id, type: 'income' } })).toBe(4);
  });

  it('requisições simultâneas de um usuário novo não quebram nem duplicam', async () => {
    const user = await newUser();
    const results = await Promise.all([1, 2, 3].map(() => request(app).get('/api/v1/me').set(user.auth)));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(await testDb.category.count({ where: { userId: user.id } })).toBe(14);
  });

  it('usuário anônimo vira perfil demo', async () => {
    const user = await newUser({ isAnonymous: true });
    const res = await request(app).get('/api/v1/me').set(user.auth);
    expect(res.body).toMatchObject({ isDemo: true, email: null, name: 'Visitante' });
  });

  it('sem nome nos metadados usa o início do e-mail', async () => {
    const user = await newUser({ email: 'joao.silva@exemplo.com' });
    const res = await request(app).get('/api/v1/me').set(user.auth);
    expect(res.body.name).toBe('joao.silva');
  });

  it('PATCH /me atualiza nome e tema', async () => {
    const user = await newUser();
    const res = await request(app).patch('/api/v1/me').set(user.auth).send({ name: '  Bia ', theme: 'dark' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Bia', theme: 'dark' });
  });

  it('PATCH /me valida o corpo', async () => {
    const user = await newUser();
    const empty = await request(app).patch('/api/v1/me').set(user.auth).send({});
    expect(empty.status).toBe(400);
    const bad = await request(app).patch('/api/v1/me').set(user.auth).send({ theme: 'azul' });
    expect(bad.status).toBe(400);
    expect(bad.body.errors[0].path).toBe('theme');
  });

  it('DELETE /me apaga todos os dados do usuário e o usuário no Auth, sem tocar nos outros', async () => {
    const user = await newUser();
    const other = await newUser();
    await request(app).get('/api/v1/me').set(user.auth);
    await request(app).get('/api/v1/me').set(other.auth);
    const account = await testDb.account.create({ data: { userId: user.id, name: 'C', type: 'checking', color: '#000000' } });
    await testDb.transaction.create({
      data: { userId: user.id, type: 'expense', amount: 100n, description: 'X', accountId: account.id, dueDate: fromDateOnly('2026-11-01') },
    });

    const res = await request(app).delete('/api/v1/me').set(user.auth);
    expect(res.status).toBe(204);
    expect(await testDb.profile.count({ where: { id: user.id } })).toBe(0);
    expect(await testDb.transaction.count({ where: { userId: user.id } })).toBe(0);
    expect(await testDb.category.count({ where: { userId: other.id } })).toBe(14);
    expect(authAdmin.deleted).toEqual([user.id]);
  });
});
```

- [ ] **Step 4: Rodar e confirmar que falha**

Run: `npm test -w @fincontrol/api -- auth-profile`
Expected: FAIL, porque `src/infra/token-verifier` e `src/http/deps` não existem.

- [ ] **Step 5: Implementar a infra de autenticação**

`apps/api/src/infra/token-verifier.ts`:
```ts
import { idSchema } from '@fincontrol/shared';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export type AuthClaims = { userId: string; isAnonymous: boolean; email: string | null; name: string | null };

export interface TokenVerifier {
  verify(token: string): Promise<AuthClaims>;
}

const asString = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

export function createJwksVerifier(opts: { getKey: JWTVerifyGetKey; issuer: string }): TokenVerifier {
  return {
    async verify(token) {
      const { payload } = await jwtVerify(token, opts.getKey, { issuer: opts.issuer, audience: 'authenticated' });
      const sub = idSchema.parse(payload.sub);
      const meta = typeof payload.user_metadata === 'object' && payload.user_metadata !== null
        ? (payload.user_metadata as Record<string, unknown>)
        : {};
      return {
        userId: sub,
        isAnonymous: payload.is_anonymous === true,
        email: asString(payload.email),
        name: asString(meta.full_name) ?? asString(meta.name),
      };
    },
  };
}

/** Requer o projeto Supabase com JWT Signing Keys assimétricas (padrão em projetos novos). */
export function createSupabaseVerifier(supabaseUrl: string): TokenVerifier {
  return createJwksVerifier({
    getKey: createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)),
    issuer: `${supabaseUrl}/auth/v1`,
  });
}
```

`apps/api/src/infra/auth-admin.ts`:
```ts
import { createClient } from '@supabase/supabase-js';

export interface AuthAdmin {
  deleteUser(userId: string): Promise<void>;
}

export function createSupabaseAuthAdmin(supabaseUrl: string, serviceRoleKey: string): AuthAdmin {
  const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async deleteUser(userId) {
      const { error } = await client.auth.admin.deleteUser(userId);
      if (error && error.status !== 404) throw new Error(`Falha ao excluir usuário no Auth: ${error.message}`);
    },
  };
}
```

`apps/api/src/http/deps.ts`:
```ts
import type { AppConfig } from '../config/env';
import type { AuthAdmin } from '../infra/auth-admin';
import type { Logger } from '../infra/logger';
import type { Db } from '../infra/prisma';
import type { TokenVerifier } from '../infra/token-verifier';

export type AppDeps = {
  config: AppConfig;
  logger: Logger;
  db: Db;
  verifier: TokenVerifier;
  authAdmin: AuthAdmin;
  clock: () => Date;
};
```

`apps/api/src/http/auth.ts`:
```ts
import type { RequestHandler, Response } from 'express';
import type { AuthClaims, TokenVerifier } from '../infra/token-verifier';
import { UnauthorizedError } from './errors';

export function requireAuth(verifier: TokenVerifier): RequestHandler {
  return async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedError();
    let claims: AuthClaims;
    try {
      claims = await verifier.verify(header.slice('Bearer '.length));
    } catch {
      throw new UnauthorizedError();
    }
    res.locals.auth = claims;
    next();
  };
}

export function authOf(res: Response): AuthClaims {
  const auth = res.locals.auth as AuthClaims | undefined;
  if (!auth) throw new UnauthorizedError();
  return auth;
}

export const userIdOf = (res: Response): string => authOf(res).userId;
```

- [ ] **Step 6: Implementar o módulo de perfil**

`apps/api/src/modules/profile/default-categories.ts`:
```ts
import type { CategoryType } from '@fincontrol/shared';

export const DEFAULT_CATEGORIES: ReadonlyArray<{ name: string; type: CategoryType; icon: string; color: string }> = [
  { name: 'Moradia', type: 'expense', icon: 'house', color: '#6366f1' },
  { name: 'Alimentação', type: 'expense', icon: 'utensils', color: '#f97316' },
  { name: 'Transporte', type: 'expense', icon: 'car', color: '#0ea5e9' },
  { name: 'Saúde', type: 'expense', icon: 'heart-pulse', color: '#ef4444' },
  { name: 'Educação', type: 'expense', icon: 'graduation-cap', color: '#8b5cf6' },
  { name: 'Lazer', type: 'expense', icon: 'party-popper', color: '#ec4899' },
  { name: 'Assinaturas', type: 'expense', icon: 'repeat', color: '#14b8a6' },
  { name: 'Compras', type: 'expense', icon: 'shopping-bag', color: '#eab308' },
  { name: 'Contas', type: 'expense', icon: 'receipt', color: '#64748b' },
  { name: 'Outros', type: 'expense', icon: 'circle-ellipsis', color: '#94a3b8' },
  { name: 'Salário', type: 'income', icon: 'briefcase', color: '#16a34a' },
  { name: 'Freelance', type: 'income', icon: 'laptop', color: '#22c55e' },
  { name: 'Rendimentos', type: 'income', icon: 'trending-up', color: '#10b981' },
  { name: 'Outros', type: 'income', icon: 'circle-plus', color: '#84cc16' },
];
```

`apps/api/src/modules/profile/provisioning.ts`:
```ts
import type { Db } from '../../infra/prisma';
import { isUniqueViolation } from '../../infra/prisma-errors';
import type { AuthClaims } from '../../infra/token-verifier';
import { DEFAULT_CATEGORIES } from './default-categories';

export type Provisioner = { ensure(claims: AuthClaims): Promise<void>; forget(userId: string): void };

function displayName(claims: AuthClaims): string {
  if (claims.name) return claims.name;
  if (claims.email) return claims.email.split('@')[0] ?? 'Visitante';
  return 'Visitante';
}

/** Cria o perfil e as categorias padrão no primeiro acesso. É idempotente e seguro com requisições concorrentes. */
export function createProvisioner(db: Db): Provisioner {
  const known = new Set<string>();
  return {
    async ensure(claims) {
      if (known.has(claims.userId)) return;
      const existing = await db.profile.findUnique({ where: { id: claims.userId }, select: { id: true } });
      if (!existing) {
        try {
          await db.$transaction([
            db.profile.create({ data: { id: claims.userId, name: displayName(claims), isDemo: claims.isAnonymous } }),
            db.category.createMany({ data: DEFAULT_CATEGORIES.map((c) => ({ ...c, userId: claims.userId })) }),
          ]);
        } catch (err) {
          if (!isUniqueViolation(err)) throw err;
        }
      }
      known.add(claims.userId);
    },
    forget(userId) {
      known.delete(userId);
    },
  };
}
```

`apps/api/src/modules/profile/profile.repository.ts`:
```ts
import type { UpdateProfileInput } from '@fincontrol/shared';
import type { Db } from '../../infra/prisma';

export function createProfileRepository(db: Db) {
  return {
    find(userId: string) {
      return db.profile.findUnique({ where: { id: userId } });
    },
    update(userId: string, data: UpdateProfileInput) {
      return db.profile.update({ where: { id: userId }, data });
    },
    async delete(userId: string) {
      await db.profile.deleteMany({ where: { id: userId } });
    },
  };
}

export type ProfileRepository = ReturnType<typeof createProfileRepository>;
```

`apps/api/src/modules/profile/profile.service.ts`:
```ts
import type { ProfileDTO, ThemePreference, UpdateProfileInput } from '@fincontrol/shared';
import { NotFoundError } from '../../http/errors';
import type { AuthAdmin } from '../../infra/auth-admin';
import type { AuthClaims } from '../../infra/token-verifier';
import type { ProfileRepository } from './profile.repository';
import type { Provisioner } from './provisioning';

type ProfileRecord = { id: string; name: string; isDemo: boolean; theme: ThemePreference };

const toDTO = (p: ProfileRecord, email: string | null): ProfileDTO => ({
  id: p.id, name: p.name, email, isDemo: p.isDemo, theme: p.theme,
});

export function createProfileService(deps: { repo: ProfileRepository; provisioner: Provisioner; authAdmin: AuthAdmin }) {
  return {
    async get(claims: AuthClaims): Promise<ProfileDTO> {
      const profile = await deps.repo.find(claims.userId);
      if (!profile) throw new NotFoundError('Perfil');
      return toDTO(profile, claims.email);
    },
    async update(claims: AuthClaims, input: UpdateProfileInput): Promise<ProfileDTO> {
      return toDTO(await deps.repo.update(claims.userId, input), claims.email);
    },
    /** LGPD: apaga os dados (cascata a partir do perfil) e depois o usuário no Supabase Auth. */
    async deleteAccount(userId: string): Promise<void> {
      await deps.repo.delete(userId);
      deps.provisioner.forget(userId);
      await deps.authAdmin.deleteUser(userId);
    },
  };
}

export type ProfileService = ReturnType<typeof createProfileService>;
```

`apps/api/src/modules/profile/profile.routes.ts`:
```ts
import { updateProfileSchema } from '@fincontrol/shared';
import { Router } from 'express';
import { authOf } from '../../http/auth';
import { parse } from '../../http/validate';
import type { ProfileService } from './profile.service';

export function profileRouter(service: ProfileService): Router {
  const r = Router();
  r.get('/', async (_req, res) => {
    res.json(await service.get(authOf(res)));
  });
  r.patch('/', async (req, res) => {
    res.json(await service.update(authOf(res), parse(updateProfileSchema, req.body)));
  });
  r.delete('/', async (_req, res) => {
    await service.deleteAccount(authOf(res).userId);
    res.status(204).end();
  });
  return r;
}
```

- [ ] **Step 7: Composição (container, rotas, app e server)**

`apps/api/src/http/container.ts`:
```ts
import { createProfileRepository } from '../modules/profile/profile.repository';
import { createProfileService } from '../modules/profile/profile.service';
import { createProvisioner } from '../modules/profile/provisioning';
import type { AppDeps } from './deps';

export function buildContainer(deps: AppDeps) {
  const provisioner = createProvisioner(deps.db);
  const profile = createProfileService({ repo: createProfileRepository(deps.db), provisioner, authAdmin: deps.authAdmin });
  return { provisioner, profile };
}

export type Container = ReturnType<typeof buildContainer>;
```

`apps/api/src/http/routes.ts`:
```ts
import type { Router } from 'express';
import { profileRouter } from '../modules/profile/profile.routes';
import type { Container } from './container';

export function registerRoutes(api: Router, c: Container): void {
  api.use('/me', profileRouter(c.profile));
}
```

`apps/api/src/http/app.ts` (substituição completa):
```ts
import cors from 'cors';
import express, { Router, type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { authOf, requireAuth } from './auth';
import { buildContainer } from './container';
import type { AppDeps } from './deps';
import { errorHandler, notFoundHandler, tooManyRequests } from './problem';
import { requestLogger } from './request-logger';
import { registerRoutes } from './routes';

export type { AppDeps } from './deps';

export const API_VERSION = '0.1.0';

export function createApp(deps: AppDeps): Express {
  const app = express();
  const container = buildContainer(deps);

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

  const api = Router();
  api.use(requireAuth(deps.verifier));
  api.use(async (_req, res, next) => {
    await container.provisioner.ensure(authOf(res));
    next();
  });
  registerRoutes(api, container);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler(deps.logger));
  return app;
}
```

`apps/api/src/server.ts` (substituição completa):
```ts
import { loadConfig } from './config/env';
import { createApp } from './http/app';
import { createSupabaseAuthAdmin } from './infra/auth-admin';
import { createLogger } from './infra/logger';
import { createPrisma } from './infra/prisma';
import { createSupabaseVerifier } from './infra/token-verifier';

const config = loadConfig();
const logger = createLogger(config.LOG_LEVEL);
const app = createApp({
  config,
  logger,
  db: createPrisma(config.DATABASE_URL),
  verifier: createSupabaseVerifier(config.SUPABASE_URL),
  authAdmin: createSupabaseAuthAdmin(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY),
  clock: () => new Date(),
});

app.listen(config.PORT, () => {
  logger.info(`API do FinControl ouvindo em http://localhost:${config.PORT}`);
});
```

- [ ] **Step 8: Rodar os testes**

Run: `npm test -w @fincontrol/api && npm run lint && npm run typecheck`
Expected: PASS, incluindo os testes da Task 4. A rota `/nao-existe` fica fora de `/api/v1` e continua devolvendo 404.

- [ ] **Step 9: Commit**

```bash
git add apps/api package-lock.json
git commit -m "feat(api): auth via JWKS do Supabase, provisionamento idempotente e /me com exclusão LGPD"
```

---

### Task 7: Domínio — saldo, previsão e variação percentual

**Files:**
- Create: `apps/api/src/domain/balance.ts`
- Test: `apps/api/src/domain/balance.test.ts`

**Interfaces:**
- Produces:
  - `type AccountFlows = { incomePaid: number; expensePaid: number; transferInPaid: number; transferOutPaid: number }`
  - `ZERO_FLOWS: AccountFlows`
  - `computeBalance(initialBalance: number, flows: AccountFlows): number`
  - `computeForecast(totalBalance: number, pendingIncome: number, pendingExpense: number): number`
  - `percentChange(current: number, previous: number): number | null` (arredondado em 1 casa decimal)

- [ ] **Step 1: Escrever o teste que falha**

`apps/api/src/domain/balance.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { computeBalance, computeForecast, percentChange, ZERO_FLOWS } from './balance';

describe('computeBalance', () => {
  it('saldo inicial + receitas − despesas + transferências recebidas − enviadas', () => {
    expect(computeBalance(10000, { incomePaid: 5000, expensePaid: 2000, transferInPaid: 300, transferOutPaid: 1000 })).toBe(12300);
  });

  it('sem movimentos é o saldo inicial, inclusive negativo', () => {
    expect(computeBalance(-500, ZERO_FLOWS)).toBe(-500);
  });
});

describe('computeForecast', () => {
  it('soma receitas pendentes e subtrai despesas pendentes', () => {
    expect(computeForecast(100000, 5000, 30000)).toBe(75000);
  });
});

describe('percentChange', () => {
  it.each([
    [150, 100, 50],
    [50, 100, -50],
    [1, 3, -66.7],
    [100, 100, 0],
  ])('%i contra %i = %d%%', (cur, prev, expected) => {
    expect(percentChange(cur, prev)).toBe(expected);
  });

  it('é null quando o mês anterior é zero', () => {
    expect(percentChange(100, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @fincontrol/api -- balance`
Expected: FAIL, porque o módulo não existe.

- [ ] **Step 3: Implementar**

`apps/api/src/domain/balance.ts`:
```ts
export type AccountFlows = {
  incomePaid: number;
  expensePaid: number;
  transferInPaid: number;
  transferOutPaid: number;
};

export const ZERO_FLOWS: AccountFlows = { incomePaid: 0, expensePaid: 0, transferInPaid: 0, transferOutPaid: 0 };

/** Só lançamentos pagos entram no saldo (spec 5.1). */
export function computeBalance(initialBalance: number, f: AccountFlows): number {
  return initialBalance + f.incomePaid - f.expensePaid + f.transferInPaid - f.transferOutPaid;
}

export function computeForecast(totalBalance: number, pendingIncome: number, pendingExpense: number): number {
  return totalBalance + pendingIncome - pendingExpense;
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm test -w @fincontrol/api -- balance && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain
git commit -m "feat(api): regras puras de saldo, previsão e variação mensal"
```

---

### Task 8: Domínio — datas de ocorrência de recorrências

**Files:**
- Create: `apps/api/src/domain/recurrence.ts`
- Test: `apps/api/src/domain/recurrence.test.ts`

**Interfaces:**
- Consumes: `addDays`, `addMonthsToYm`, `dateInMonth`, `monthOf`, os tipos `DateOnly` e `Frequency` de `@fincontrol/shared`.
- Produces:
  - `nthOccurrence(frequency: Frequency, startDate: DateOnly, k: number): DateOnly`
  - `occurrenceDates(p: { frequency: Frequency; startDate: DateOnly; endDate: DateOnly | null; until: DateOnly }): DateOnly[]`
  - `MAX_OCCURRENCES = 1000`

- [ ] **Step 1: Escrever o teste que falha**

`apps/api/src/domain/recurrence.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { nthOccurrence, occurrenceDates } from './recurrence';

describe('occurrenceDates', () => {
  it('mensal no dia 31 cai no último dia dos meses curtos e volta ao 31 depois', () => {
    expect(occurrenceDates({ frequency: 'monthly', startDate: '2026-01-31', endDate: null, until: '2026-05-31' })).toEqual([
      '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31',
    ]);
  });

  it('semanal soma 7 dias', () => {
    expect(occurrenceDates({ frequency: 'weekly', startDate: '2026-12-24', endDate: null, until: '2027-01-14' })).toEqual([
      '2026-12-24', '2026-12-31', '2027-01-07', '2027-01-14',
    ]);
  });

  it('anual em 29/02 cai em 28/02 nos anos não bissextos', () => {
    expect(occurrenceDates({ frequency: 'yearly', startDate: '2028-02-29', endDate: null, until: '2032-03-01' })).toEqual([
      '2028-02-29', '2029-02-28', '2030-02-28', '2031-02-28', '2032-02-29',
    ]);
  });

  it('respeita a data final inclusiva', () => {
    expect(occurrenceDates({ frequency: 'monthly', startDate: '2026-01-10', endDate: '2026-03-10', until: '2026-12-31' })).toEqual([
      '2026-01-10', '2026-02-10', '2026-03-10',
    ]);
  });

  it('é vazio quando o limite é anterior ao início', () => {
    expect(occurrenceDates({ frequency: 'monthly', startDate: '2026-05-01', endDate: null, until: '2026-04-30' })).toEqual([]);
  });

  it('é vazio quando a data final é anterior ao início (série encerrada)', () => {
    expect(occurrenceDates({ frequency: 'monthly', startDate: '2026-05-01', endDate: '2026-04-30', until: '2026-12-31' })).toEqual([]);
  });

  it('nunca passa do teto de ocorrências', () => {
    expect(occurrenceDates({ frequency: 'weekly', startDate: '2000-01-01', endDate: null, until: '2100-01-01' })).toHaveLength(1000);
  });
});

describe('nthOccurrence', () => {
  it('calcula a partir do início, não da ocorrência anterior', () => {
    expect(nthOccurrence('monthly', '2026-01-31', 2)).toBe('2026-03-31');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @fincontrol/api -- recurrence`
Expected: FAIL, porque o módulo não existe.

- [ ] **Step 3: Implementar**

`apps/api/src/domain/recurrence.ts`:
```ts
import { addDays, addMonthsToYm, dateInMonth, monthOf, type DateOnly, type Frequency } from '@fincontrol/shared';

export const MAX_OCCURRENCES = 1000;

/**
 * k-ésima ocorrência, calculada sempre a partir do início. Assim uma série no dia 31
 * cai em 28/02 e volta a 31/03 (spec 5.3).
 */
export function nthOccurrence(frequency: Frequency, startDate: DateOnly, k: number): DateOnly {
  if (frequency === 'weekly') return addDays(startDate, 7 * k);
  const day = Number(startDate.slice(8, 10));
  const months = frequency === 'monthly' ? k : 12 * k;
  return dateInMonth(addMonthsToYm(monthOf(startDate), months), day);
}

export function occurrenceDates(p: {
  frequency: Frequency;
  startDate: DateOnly;
  endDate: DateOnly | null;
  until: DateOnly;
}): DateOnly[] {
  const limit = p.endDate !== null && p.endDate < p.until ? p.endDate : p.until;
  const dates: DateOnly[] = [];
  for (let k = 0; k < MAX_OCCURRENCES; k++) {
    const d = nthOccurrence(p.frequency, p.startDate, k);
    if (d > limit) break;
    dates.push(d);
  }
  return dates;
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm test -w @fincontrol/api -- recurrence && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain
git commit -m "feat(api): cálculo puro das datas de ocorrência de recorrências"
```

---

### Task 9: Módulo de contas

**Files:**
- Create: `apps/api/src/modules/accounts/accounts.repository.ts`, `accounts.service.ts`, `accounts.routes.ts`
- Create: `apps/api/test/helpers/factories.ts`
- Modify: `apps/api/src/http/container.ts`, `apps/api/src/http/routes.ts`
- Test: `apps/api/test/accounts.test.ts`

**Interfaces:**
- Consumes: `AccountFlows`, `ZERO_FLOWS`, `computeBalance` (Task 7); `createAccountSchema`, `updateAccountSchema`, `listAccountsQuerySchema`, `idSchema`, os tipos `AccountDTO` e `AccountType`.
- Produces:
  - `type AccountRow = { id; name; type: AccountType; color; initialBalance: number; archivedAt: Date | null; createdAt: Date }`
  - `createAccountsRepository(db)`, com `list`, `findById`, `findActiveByName`, `create`, `update`, `setArchived`, `delete`, `isReferenced` e `flowsByAccount(userId): Promise<Map<string, AccountFlows>>`
  - `AccountsService`, com `list(userId, includeArchived)`, `create`, `update`, `archive`, `unarchive`, `remove`, `assertUsable(userId, id)` (404 se não existir, 422 se arquivada)
  - Helper de teste: `createAccount(app, user, body?) → Promise<AccountDTO>`

- [ ] **Step 1: Escrever o helper e o teste que falha**

`apps/api/test/helpers/factories.ts`:
```ts
import type { AccountDTO } from '@fincontrol/shared';
import type { Express } from 'express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { expect } from 'vitest';
import type { TestUser } from './auth';

export async function createAccount(app: Express, user: TestUser, body: Record<string, unknown> = {}): Promise<AccountDTO> {
  const res = await request(app)
    .post('/api/v1/accounts')
    .set(user.auth)
    .send({ name: `Conta ${randomUUID().slice(0, 8)}`, type: 'checking', color: '#2563eb', initialBalance: 0, ...body });
  expect(res.status).toBe(201);
  return res.body as AccountDTO;
}
```

`apps/api/test/accounts.test.ts`:
```ts
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { fromDateOnly } from '../src/infra/date-mapping';
import { buildTestApp } from './helpers/app';
import { newUser } from './helpers/auth';
import { resetDb, testDb } from './helpers/db';
import { createAccount } from './helpers/factories';

const { app } = buildTestApp();

async function insertPaid(userId: string, accountId: string, type: 'income' | 'expense', amount: bigint) {
  await testDb.transaction.create({
    data: {
      userId, type, amount, description: 'X', accountId, status: 'paid',
      dueDate: fromDateOnly('2026-11-01'), paidDate: fromDateOnly('2026-11-01'),
    },
  });
}

describe('contas', () => {
  beforeEach(resetDb);

  it('cria conta com saldo igual ao saldo inicial', async () => {
    const user = await newUser();
    const acc = await createAccount(app, user, { name: 'Nubank', initialBalance: 150000 });
    expect(acc).toMatchObject({ name: 'Nubank', type: 'checking', initialBalance: 150000, balance: 150000, archivedAt: null });
  });

  it('calcula o saldo só com lançamentos pagos, incluindo transferências', async () => {
    const user = await newUser();
    const a = await createAccount(app, user, { initialBalance: 10000 });
    const b = await createAccount(app, user, { initialBalance: 0 });
    await insertPaid(user.id, a.id, 'income', 5000n);
    await insertPaid(user.id, a.id, 'expense', 2000n);
    await testDb.transaction.create({
      data: { userId: user.id, type: 'expense', amount: 99999n, description: 'Pendente', accountId: a.id, dueDate: fromDateOnly('2026-11-20') },
    });
    await testDb.transaction.create({
      data: {
        userId: user.id, type: 'transfer', amount: 3000n, description: 'Reserva', accountId: a.id, destinationAccountId: b.id,
        status: 'paid', dueDate: fromDateOnly('2026-11-02'), paidDate: fromDateOnly('2026-11-02'),
      },
    });
    const res = await request(app).get('/api/v1/accounts').set(user.auth);
    const byId = Object.fromEntries((res.body as { id: string; balance: number }[]).map((x) => [x.id, x.balance]));
    expect(byId[a.id]).toBe(10000);
    expect(byId[b.id]).toBe(3000);
  });

  it('impede nome duplicado entre contas ativas (sem diferenciar maiúsculas)', async () => {
    const user = await newUser();
    await createAccount(app, user, { name: 'Carteira' });
    const res = await request(app).post('/api/v1/accounts').set(user.auth).send({ name: 'carteira', type: 'wallet', color: '#000000' });
    expect(res.status).toBe(409);
  });

  it('edita conta', async () => {
    const user = await newUser();
    const acc = await createAccount(app, user);
    const res = await request(app).patch(`/api/v1/accounts/${acc.id}`).set(user.auth).send({ name: 'Itaú', color: '#f97316' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Itaú', color: '#f97316' });
  });

  it('arquivar esconde da lista padrão e includeArchived mostra', async () => {
    const user = await newUser();
    const acc = await createAccount(app, user);
    const archived = await request(app).post(`/api/v1/accounts/${acc.id}/archive`).set(user.auth);
    expect(archived.body.archivedAt).not.toBeNull();
    expect((await request(app).get('/api/v1/accounts').set(user.auth)).body).toHaveLength(0);
    expect((await request(app).get('/api/v1/accounts?includeArchived=true').set(user.auth)).body).toHaveLength(1);
    const restored = await request(app).post(`/api/v1/accounts/${acc.id}/unarchive`).set(user.auth);
    expect(restored.body.archivedAt).toBeNull();
  });

  it('exclui conta sem lançamentos e bloqueia com lançamentos', async () => {
    const user = await newUser();
    const empty = await createAccount(app, user);
    expect((await request(app).delete(`/api/v1/accounts/${empty.id}`).set(user.auth)).status).toBe(204);
    const used = await createAccount(app, user);
    await insertPaid(user.id, used.id, 'expense', 100n);
    const res = await request(app).delete(`/api/v1/accounts/${used.id}`).set(user.auth);
    expect(res.status).toBe(409);
  });

  it('valida o corpo', async () => {
    const user = await newUser();
    const res = await request(app).post('/api/v1/accounts').set(user.auth).send({ name: 'X', type: 'checking', color: 'azul', initialBalance: 10.5 });
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e: { path: string }) => e.path)).toEqual(expect.arrayContaining(['color', 'initialBalance']));
  });

  it('isolamento: outro usuário não vê nem altera a conta (404)', async () => {
    const owner = await newUser();
    const intruder = await newUser();
    const acc = await createAccount(app, owner);
    expect((await request(app).get('/api/v1/accounts').set(intruder.auth)).body).toHaveLength(0);
    for (const call of [
      request(app).patch(`/api/v1/accounts/${acc.id}`).set(intruder.auth).send({ name: 'Hack' }),
      request(app).delete(`/api/v1/accounts/${acc.id}`).set(intruder.auth),
      request(app).post(`/api/v1/accounts/${acc.id}/archive`).set(intruder.auth),
    ]) {
      expect((await call).status).toBe(404);
    }
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @fincontrol/api -- accounts`
Expected: FAIL, com 401 ou 404 nas chamadas, porque a rota `/accounts` não existe.

- [ ] **Step 3: Implementar o repository**

`apps/api/src/modules/accounts/accounts.repository.ts`:
```ts
import type { AccountType } from '@fincontrol/shared';
import { ZERO_FLOWS, type AccountFlows } from '../../domain/balance';
import type { Db } from '../../infra/prisma';

export type AccountRow = {
  id: string;
  name: string;
  type: AccountType;
  color: string;
  initialBalance: number;
  archivedAt: Date | null;
  createdAt: Date;
};

type AccountRecord = Omit<AccountRow, 'initialBalance'> & { initialBalance: bigint };
type AccountData = { name: string; type: AccountType; color: string; initialBalance: number };

const toRow = (a: AccountRecord): AccountRow => ({
  id: a.id, name: a.name, type: a.type, color: a.color,
  initialBalance: Number(a.initialBalance), archivedAt: a.archivedAt, createdAt: a.createdAt,
});

export function createAccountsRepository(db: Db) {
  return {
    async list(userId: string, includeArchived: boolean): Promise<AccountRow[]> {
      const rows = await db.account.findMany({
        where: { userId, ...(includeArchived ? {} : { archivedAt: null }) },
        orderBy: { createdAt: 'asc' },
      });
      return rows.map(toRow);
    },

    async findById(userId: string, id: string): Promise<AccountRow | null> {
      const row = await db.account.findFirst({ where: { id, userId } });
      return row ? toRow(row) : null;
    },

    async findActiveByName(userId: string, name: string, exceptId?: string): Promise<AccountRow | null> {
      const row = await db.account.findFirst({
        where: {
          userId, archivedAt: null, name: { equals: name, mode: 'insensitive' },
          ...(exceptId ? { NOT: { id: exceptId } } : {}),
        },
      });
      return row ? toRow(row) : null;
    },

    async create(userId: string, data: AccountData): Promise<AccountRow> {
      return toRow(await db.account.create({ data: { ...data, initialBalance: BigInt(data.initialBalance), userId } }));
    },

    async update(userId: string, id: string, data: Partial<AccountData>): Promise<AccountRow> {
      const { initialBalance, ...rest } = data;
      return toRow(
        await db.account.update({
          where: { id, userId },
          data: { ...rest, ...(initialBalance !== undefined ? { initialBalance: BigInt(initialBalance) } : {}) },
        }),
      );
    },

    async setArchived(userId: string, id: string, archivedAt: Date | null): Promise<AccountRow> {
      return toRow(await db.account.update({ where: { id, userId }, data: { archivedAt } }));
    },

    async delete(userId: string, id: string): Promise<void> {
      await db.account.delete({ where: { id, userId } });
    },

    /** Conta referenciada por lançamento ou recorrência (como origem ou destino). */
    async isReferenced(userId: string, id: string): Promise<boolean> {
      const where = { userId, OR: [{ accountId: id }, { destinationAccountId: id }] };
      const [transactions, recurrences] = await Promise.all([db.transaction.count({ where }), db.recurrence.count({ where })]);
      return transactions + recurrences > 0;
    },

    async flowsByAccount(userId: string): Promise<Map<string, AccountFlows>> {
      const flows = new Map<string, AccountFlows>();
      const get = (id: string): AccountFlows => {
        let f = flows.get(id);
        if (!f) {
          f = { ...ZERO_FLOWS };
          flows.set(id, f);
        }
        return f;
      };

      const own = await db.transaction.groupBy({
        by: ['accountId', 'type'],
        where: { userId, status: 'paid' },
        _sum: { amount: true },
      });
      for (const g of own) {
        const value = Number(g._sum.amount ?? 0n);
        const f = get(g.accountId);
        if (g.type === 'income') f.incomePaid += value;
        else if (g.type === 'expense') f.expensePaid += value;
        else f.transferOutPaid += value;
      }

      const incoming = await db.transaction.groupBy({
        by: ['destinationAccountId'],
        where: { userId, status: 'paid', type: 'transfer' },
        _sum: { amount: true },
      });
      for (const g of incoming) {
        if (g.destinationAccountId) get(g.destinationAccountId).transferInPaid += Number(g._sum.amount ?? 0n);
      }
      return flows;
    },
  };
}

export type AccountsRepository = ReturnType<typeof createAccountsRepository>;
```

- [ ] **Step 4: Implementar o service e as rotas**

`apps/api/src/modules/accounts/accounts.service.ts`:
```ts
import type { AccountDTO, CreateAccountInput, UpdateAccountInput } from '@fincontrol/shared';
import { computeBalance, ZERO_FLOWS, type AccountFlows } from '../../domain/balance';
import { ConflictError, NotFoundError, UnprocessableError } from '../../http/errors';
import type { AccountRow, AccountsRepository } from './accounts.repository';

const toDTO = (a: AccountRow, flows: AccountFlows = ZERO_FLOWS): AccountDTO => ({
  id: a.id,
  name: a.name,
  type: a.type,
  color: a.color,
  initialBalance: a.initialBalance,
  balance: computeBalance(a.initialBalance, flows),
  archivedAt: a.archivedAt?.toISOString() ?? null,
  createdAt: a.createdAt.toISOString(),
});

export function createAccountsService(repo: AccountsRepository) {
  async function getOwned(userId: string, id: string): Promise<AccountRow> {
    const account = await repo.findById(userId, id);
    if (!account) throw new NotFoundError('Conta');
    return account;
  }

  async function assertNameFree(userId: string, name: string, exceptId?: string): Promise<void> {
    if (await repo.findActiveByName(userId, name, exceptId)) throw new ConflictError('Já existe uma conta ativa com esse nome.');
  }

  async function withBalance(userId: string, account: AccountRow): Promise<AccountDTO> {
    const flows = await repo.flowsByAccount(userId);
    return toDTO(account, flows.get(account.id));
  }

  return {
    async list(userId: string, includeArchived: boolean): Promise<AccountDTO[]> {
      const [rows, flows] = await Promise.all([repo.list(userId, includeArchived), repo.flowsByAccount(userId)]);
      return rows.map((a) => toDTO(a, flows.get(a.id)));
    },

    async create(userId: string, input: CreateAccountInput): Promise<AccountDTO> {
      await assertNameFree(userId, input.name);
      return toDTO(await repo.create(userId, input));
    },

    async update(userId: string, id: string, input: UpdateAccountInput): Promise<AccountDTO> {
      const current = await getOwned(userId, id);
      if (input.name !== undefined && current.archivedAt === null) await assertNameFree(userId, input.name, id);
      return withBalance(userId, await repo.update(userId, id, input));
    },

    async archive(userId: string, id: string): Promise<AccountDTO> {
      await getOwned(userId, id);
      return withBalance(userId, await repo.setArchived(userId, id, new Date()));
    },

    async unarchive(userId: string, id: string): Promise<AccountDTO> {
      const account = await getOwned(userId, id);
      await assertNameFree(userId, account.name, id);
      return withBalance(userId, await repo.setArchived(userId, id, null));
    },

    async remove(userId: string, id: string): Promise<void> {
      await getOwned(userId, id);
      if (await repo.isReferenced(userId, id)) {
        throw new ConflictError('A conta possui lançamentos. Arquive-a em vez de excluir.');
      }
      await repo.delete(userId, id);
    },

    async assertUsable(userId: string, id: string): Promise<void> {
      const account = await getOwned(userId, id);
      if (account.archivedAt) throw new UnprocessableError('Não é possível lançar em uma conta arquivada.');
    },
  };
}

export type AccountsService = ReturnType<typeof createAccountsService>;
```

`apps/api/src/modules/accounts/accounts.routes.ts`:
```ts
import { createAccountSchema, idSchema, listAccountsQuerySchema, updateAccountSchema } from '@fincontrol/shared';
import { Router } from 'express';
import { userIdOf } from '../../http/auth';
import { parse } from '../../http/validate';
import type { AccountsService } from './accounts.service';

export function accountsRouter(service: AccountsService): Router {
  const r = Router();
  r.get('/', async (req, res) => {
    const { includeArchived } = parse(listAccountsQuerySchema, req.query);
    res.json(await service.list(userIdOf(res), includeArchived));
  });
  r.post('/', async (req, res) => {
    res.status(201).json(await service.create(userIdOf(res), parse(createAccountSchema, req.body)));
  });
  r.patch('/:id', async (req, res) => {
    res.json(await service.update(userIdOf(res), parse(idSchema, req.params.id), parse(updateAccountSchema, req.body)));
  });
  r.delete('/:id', async (req, res) => {
    await service.remove(userIdOf(res), parse(idSchema, req.params.id));
    res.status(204).end();
  });
  r.post('/:id/archive', async (req, res) => {
    res.json(await service.archive(userIdOf(res), parse(idSchema, req.params.id)));
  });
  r.post('/:id/unarchive', async (req, res) => {
    res.json(await service.unarchive(userIdOf(res), parse(idSchema, req.params.id)));
  });
  return r;
}
```

- [ ] **Step 5: Registrar no container e nas rotas**

`apps/api/src/http/container.ts` (substituição completa):
```ts
import { createAccountsRepository } from '../modules/accounts/accounts.repository';
import { createAccountsService } from '../modules/accounts/accounts.service';
import { createProfileRepository } from '../modules/profile/profile.repository';
import { createProfileService } from '../modules/profile/profile.service';
import { createProvisioner } from '../modules/profile/provisioning';
import type { AppDeps } from './deps';

export function buildContainer(deps: AppDeps) {
  const provisioner = createProvisioner(deps.db);
  const profile = createProfileService({ repo: createProfileRepository(deps.db), provisioner, authAdmin: deps.authAdmin });
  const accountsRepo = createAccountsRepository(deps.db);
  const accounts = createAccountsService(accountsRepo);
  return { provisioner, profile, accountsRepo, accounts };
}

export type Container = ReturnType<typeof buildContainer>;
```

`apps/api/src/http/routes.ts` (substituição completa):
```ts
import type { Router } from 'express';
import { accountsRouter } from '../modules/accounts/accounts.routes';
import { profileRouter } from '../modules/profile/profile.routes';
import type { Container } from './container';

export function registerRoutes(api: Router, c: Container): void {
  api.use('/me', profileRouter(c.profile));
  api.use('/accounts', accountsRouter(c.accounts));
}
```

- [ ] **Step 6: Rodar os testes**

Run: `npm test -w @fincontrol/api && npm run lint && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api
git commit -m "feat(api): contas com saldo calculado, arquivamento e isolamento por usuário"
```

---

### Task 10: Módulo de categorias

**Files:**
- Create: `apps/api/src/modules/categories/categories.repository.ts`, `categories.service.ts`, `categories.routes.ts`
- Modify: `apps/api/src/http/container.ts`, `apps/api/src/http/routes.ts`, `apps/api/test/helpers/factories.ts`
- Test: `apps/api/test/categories.test.ts`

**Interfaces:**
- Consumes: `createCategorySchema`, `updateCategorySchema`, `listCategoriesQuerySchema`, `deleteCategoryQuerySchema`, os tipos `CategoryDTO` e `CategoryType`.
- Produces:
  - `type CategoryRow = CategoryDTO`
  - `createCategoriesRepository(db)`, com `list`, `findById`, `findByName`, `create`, `update`, `delete`, `isInUse` e `reassignAndDelete`
  - `CategoriesService`, com `list(userId, type?)`, `create`, `update`, `remove(userId, id, reassignTo?)`, `assertMatches(userId, categoryId, type)` (404 se não existir, 422 se o tipo for diferente)
  - Helper de teste: `categoryId(app, user, name, type) → Promise<string>`

- [ ] **Step 1: Acrescentar o helper e escrever o teste que falha**

Acrescente ao fim de `apps/api/test/helpers/factories.ts`:
```ts
export async function categoryId(app: Express, user: TestUser, name: string, type: 'income' | 'expense'): Promise<string> {
  const res = await request(app).get(`/api/v1/categories?type=${type}`).set(user.auth);
  const found = (res.body as { id: string; name: string }[]).find((c) => c.name === name);
  if (!found) throw new Error(`Categoria ${name} (${type}) não encontrada`);
  return found.id;
}
```

`apps/api/test/categories.test.ts`:
```ts
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { fromDateOnly } from '../src/infra/date-mapping';
import { buildTestApp } from './helpers/app';
import { newUser } from './helpers/auth';
import { resetDb, testDb } from './helpers/db';
import { categoryId, createAccount } from './helpers/factories';

const { app } = buildTestApp();

describe('categorias', () => {
  beforeEach(resetDb);

  it('lista as categorias padrão e filtra por tipo', async () => {
    const user = await newUser();
    expect((await request(app).get('/api/v1/categories').set(user.auth)).body).toHaveLength(14);
    const income = await request(app).get('/api/v1/categories?type=income').set(user.auth);
    expect(income.body.map((c: { name: string }) => c.name).sort()).toEqual(['Freelance', 'Outros', 'Rendimentos', 'Salário']);
  });

  it('cria, edita e impede nome duplicado no mesmo tipo', async () => {
    const user = await newUser();
    const created = await request(app).post('/api/v1/categories').set(user.auth).send({ name: 'Pets', type: 'expense', icon: 'dog', color: '#a855f7' });
    expect(created.status).toBe(201);
    const dup = await request(app).post('/api/v1/categories').set(user.auth).send({ name: 'pets', type: 'expense', icon: 'dog', color: '#a855f7' });
    expect(dup.status).toBe(409);
    const sameNameOtherType = await request(app).post('/api/v1/categories').set(user.auth).send({ name: 'Pets', type: 'income', icon: 'dog', color: '#a855f7' });
    expect(sameNameOtherType.status).toBe(201);
    const edited = await request(app).patch(`/api/v1/categories/${created.body.id}`).set(user.auth).send({ name: 'Animais' });
    expect(edited.body).toMatchObject({ name: 'Animais', type: 'expense' });
  });

  it('exclui categoria sem uso diretamente', async () => {
    const user = await newUser();
    const id = await categoryId(app, user, 'Educação', 'expense');
    expect((await request(app).delete(`/api/v1/categories/${id}`).set(user.auth)).status).toBe(204);
  });

  it('categoria em uso exige reassignTo e move os lançamentos', async () => {
    const user = await newUser();
    const acc = await createAccount(app, user);
    const lazer = await categoryId(app, user, 'Lazer', 'expense');
    const outros = await categoryId(app, user, 'Outros', 'expense');
    const tx = await testDb.transaction.create({
      data: { userId: user.id, type: 'expense', amount: 100n, description: 'Cinema', accountId: acc.id, categoryId: lazer, nature: 'variable', dueDate: fromDateOnly('2026-11-01') },
    });
    expect((await request(app).delete(`/api/v1/categories/${lazer}`).set(user.auth)).status).toBe(409);
    const res = await request(app).delete(`/api/v1/categories/${lazer}?reassignTo=${outros}`).set(user.auth);
    expect(res.status).toBe(204);
    expect((await testDb.transaction.findUniqueOrThrow({ where: { id: tx.id } })).categoryId).toBe(outros);
  });

  it('categoria usada só pelo template de uma recorrência também está em uso (409, não 500)', async () => {
    const user = await newUser();
    const acc = await createAccount(app, user);
    const assinaturas = await categoryId(app, user, 'Assinaturas', 'expense');
    await testDb.recurrence.create({
      data: {
        userId: user.id, frequency: 'monthly', startDate: fromDateOnly('2026-11-20'), type: 'expense', amount: 5590n,
        description: 'Streaming', accountId: acc.id, categoryId: assinaturas, nature: 'fixed',
      },
    });
    expect((await request(app).delete(`/api/v1/categories/${assinaturas}`).set(user.auth)).status).toBe(409);
  });

  it('reassignTo de outro tipo ou a própria categoria dá 422', async () => {
    const user = await newUser();
    const acc = await createAccount(app, user);
    const lazer = await categoryId(app, user, 'Lazer', 'expense');
    const salario = await categoryId(app, user, 'Salário', 'income');
    await testDb.transaction.create({
      data: { userId: user.id, type: 'expense', amount: 100n, description: 'X', accountId: acc.id, categoryId: lazer, nature: 'variable', dueDate: fromDateOnly('2026-11-01') },
    });
    expect((await request(app).delete(`/api/v1/categories/${lazer}?reassignTo=${salario}`).set(user.auth)).status).toBe(422);
    expect((await request(app).delete(`/api/v1/categories/${lazer}?reassignTo=${lazer}`).set(user.auth)).status).toBe(422);
  });

  it('isolamento: categoria de outro usuário dá 404', async () => {
    const owner = await newUser();
    const intruder = await newUser();
    const id = await categoryId(app, owner, 'Lazer', 'expense');
    await request(app).get('/api/v1/me').set(intruder.auth);
    expect((await request(app).patch(`/api/v1/categories/${id}`).set(intruder.auth).send({ name: 'X' })).status).toBe(404);
    expect((await request(app).delete(`/api/v1/categories/${id}`).set(intruder.auth)).status).toBe(404);
    const intruderOutros = await categoryId(app, intruder, 'Outros', 'expense');
    expect((await request(app).delete(`/api/v1/categories/${intruderOutros}?reassignTo=${id}`).set(intruder.auth)).status).toBe(204);
  });
});
```

> No último teste, a categoria `Outros` do intruso não está em uso, então é excluída direto e o `reassignTo` alheio nem chega a ser consultado. O que prova o isolamento são as duas chamadas anteriores.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @fincontrol/api -- categories`
Expected: FAIL, porque a rota `/categories` não existe.

- [ ] **Step 3: Implementar o repository, o service e as rotas**

`apps/api/src/modules/categories/categories.repository.ts`:
```ts
import type { CategoryDTO, CategoryType } from '@fincontrol/shared';
import type { Db } from '../../infra/prisma';

export type CategoryRow = CategoryDTO;
type CategoryData = { name: string; type: CategoryType; icon: string; color: string };

const select = { id: true, name: true, type: true, icon: true, color: true } as const;

export function createCategoriesRepository(db: Db) {
  return {
    list(userId: string, type?: CategoryType): Promise<CategoryRow[]> {
      return db.category.findMany({
        where: { userId, ...(type ? { type } : {}) },
        select,
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      });
    },

    findById(userId: string, id: string): Promise<CategoryRow | null> {
      return db.category.findFirst({ where: { id, userId }, select });
    },

    findByName(userId: string, type: CategoryType, name: string, exceptId?: string): Promise<CategoryRow | null> {
      return db.category.findFirst({
        where: { userId, type, name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
        select,
      });
    },

    create(userId: string, data: CategoryData): Promise<CategoryRow> {
      return db.category.create({ data: { ...data, userId }, select });
    },

    update(userId: string, id: string, data: Partial<Omit<CategoryData, 'type'>>): Promise<CategoryRow> {
      return db.category.update({ where: { id, userId }, data, select });
    },

    async delete(userId: string, id: string): Promise<void> {
      await db.category.delete({ where: { id, userId } });
    },

    async isInUse(userId: string, id: string): Promise<boolean> {
      const [transactions, recurrences] = await Promise.all([
        db.transaction.count({ where: { userId, categoryId: id } }),
        db.recurrence.count({ where: { userId, categoryId: id } }),
      ]);
      return transactions + recurrences > 0;
    },

    async reassignAndDelete(userId: string, fromId: string, toId: string): Promise<void> {
      await db.$transaction([
        db.transaction.updateMany({ where: { userId, categoryId: fromId }, data: { categoryId: toId } }),
        db.recurrence.updateMany({ where: { userId, categoryId: fromId }, data: { categoryId: toId } }),
        db.category.delete({ where: { id: fromId, userId } }),
      ]);
    },
  };
}

export type CategoriesRepository = ReturnType<typeof createCategoriesRepository>;
```

`apps/api/src/modules/categories/categories.service.ts`:
```ts
import type { CategoryDTO, CategoryType, CreateCategoryInput, UpdateCategoryInput } from '@fincontrol/shared';
import { ConflictError, NotFoundError, UnprocessableError } from '../../http/errors';
import type { CategoriesRepository, CategoryRow } from './categories.repository';

export function createCategoriesService(repo: CategoriesRepository) {
  async function getOwned(userId: string, id: string): Promise<CategoryRow> {
    const category = await repo.findById(userId, id);
    if (!category) throw new NotFoundError('Categoria');
    return category;
  }

  async function assertNameFree(userId: string, type: CategoryType, name: string, exceptId?: string): Promise<void> {
    if (await repo.findByName(userId, type, name, exceptId)) throw new ConflictError('Já existe uma categoria com esse nome.');
  }

  return {
    list(userId: string, type?: CategoryType): Promise<CategoryDTO[]> {
      return repo.list(userId, type);
    },

    async create(userId: string, input: CreateCategoryInput): Promise<CategoryDTO> {
      await assertNameFree(userId, input.type, input.name);
      return repo.create(userId, input);
    },

    async update(userId: string, id: string, input: UpdateCategoryInput): Promise<CategoryDTO> {
      const current = await getOwned(userId, id);
      if (input.name !== undefined) await assertNameFree(userId, current.type, input.name, id);
      return repo.update(userId, id, input);
    },

    async remove(userId: string, id: string, reassignTo?: string): Promise<void> {
      const current = await getOwned(userId, id);
      if (!(await repo.isInUse(userId, id))) {
        await repo.delete(userId, id);
        return;
      }
      if (!reassignTo) {
        throw new ConflictError('A categoria está em uso. Informe em reassignTo a categoria que receberá os lançamentos.');
      }
      const target = await getOwned(userId, reassignTo);
      if (target.id === current.id || target.type !== current.type) {
        throw new UnprocessableError('A categoria de destino deve ser outra categoria do mesmo tipo.');
      }
      await repo.reassignAndDelete(userId, current.id, target.id);
    },

    async assertMatches(userId: string, categoryId: string, type: CategoryType): Promise<void> {
      const category = await getOwned(userId, categoryId);
      if (category.type !== type) throw new UnprocessableError('A categoria não corresponde ao tipo do lançamento.');
    },
  };
}

export type CategoriesService = ReturnType<typeof createCategoriesService>;
```

`apps/api/src/modules/categories/categories.routes.ts`:
```ts
import {
  createCategorySchema, deleteCategoryQuerySchema, idSchema, listCategoriesQuerySchema, updateCategorySchema,
} from '@fincontrol/shared';
import { Router } from 'express';
import { userIdOf } from '../../http/auth';
import { parse } from '../../http/validate';
import type { CategoriesService } from './categories.service';

export function categoriesRouter(service: CategoriesService): Router {
  const r = Router();
  r.get('/', async (req, res) => {
    const { type } = parse(listCategoriesQuerySchema, req.query);
    res.json(await service.list(userIdOf(res), type));
  });
  r.post('/', async (req, res) => {
    res.status(201).json(await service.create(userIdOf(res), parse(createCategorySchema, req.body)));
  });
  r.patch('/:id', async (req, res) => {
    res.json(await service.update(userIdOf(res), parse(idSchema, req.params.id), parse(updateCategorySchema, req.body)));
  });
  r.delete('/:id', async (req, res) => {
    const { reassignTo } = parse(deleteCategoryQuerySchema, req.query);
    await service.remove(userIdOf(res), parse(idSchema, req.params.id), reassignTo);
    res.status(204).end();
  });
  return r;
}
```

- [ ] **Step 4: Registrar**

Em `apps/api/src/http/container.ts`, acrescente os imports:
```ts
import { createCategoriesRepository } from '../modules/categories/categories.repository';
import { createCategoriesService } from '../modules/categories/categories.service';
```
e, dentro de `buildContainer`, troque o `return` por:
```ts
  const categoriesRepo = createCategoriesRepository(deps.db);
  const categories = createCategoriesService(categoriesRepo);
  return { provisioner, profile, accountsRepo, accounts, categoriesRepo, categories };
```

Em `apps/api/src/http/routes.ts`, acrescente o import `import { categoriesRouter } from '../modules/categories/categories.routes';` e a linha:
```ts
  api.use('/categories', categoriesRouter(c.categories));
```

- [ ] **Step 5: Rodar os testes**

Run: `npm test -w @fincontrol/api && npm run lint && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat(api): categorias com reatribuição obrigatória ao excluir categoria em uso"
```

---

### Task 11: Módulo de lançamentos (sem recorrência)

**Files:**
- Create: `apps/api/src/modules/transactions/transactions.repository.ts`, `transactions.mapper.ts`, `transactions.refs.ts`, `transactions.cursor.ts`, `transactions.service.ts`, `transactions.routes.ts`
- Modify: `apps/api/src/http/container.ts`, `apps/api/src/http/routes.ts`, `apps/api/test/helpers/factories.ts`
- Test: `apps/api/test/transactions.test.ts`

**Interfaces:**
- Consumes: `AccountsService.assertUsable`, `CategoriesService.assertMatches`, `transactionShapeIssues`, os schemas de lançamentos, `toDateOnly`/`fromDateOnly`, `todayInSaoPaulo`.
- Produces:
  - `type TransactionRow = { id; type; amount: number; description; accountId; destinationAccountId: string | null; categoryId: string | null; nature: TransactionNature | null; status; dueDate: DateOnly; paidDate: DateOnly | null; recurrenceId: string | null; occurrenceDate: DateOnly | null; createdAt: Date }`
  - `type NewTransaction = Omit<TransactionRow, 'id' | 'createdAt'>`
  - `type TransactionFilters = { from?; to?; accountId?; categoryId?; type?; status?; q? }`, `type Cursor = { dueDate: DateOnly; id: string }`
  - `createTransactionsRepository(db)`, com `list(userId, filters, cursor, take)`, `findById`, `findByOccurrence(userId, recurrenceId, occurrenceDate)`, `create(userId, t)`, `update(userId, id, patch)`, `delete(userId, id)`, `insertMany(userId, rows)` (ignora duplicatas) e `listPendingUntil(userId, until, limit)`
  - `toTransactionDTO(row, today): TransactionDTO`
  - `createRefsValidator(accounts, categories): ValidateRefs`, onde `ValidateRefs = (userId, t: ShapeInput, check?: { account?: boolean; destination?: boolean; category?: boolean }) => Promise<void>`
  - `encodeCursor(row)`, `decodeCursor(raw): Cursor`
  - `TransactionsService`, com `create`, `list`, `update(userId, id, input)`, `remove(userId, id)`, `pay(userId, id, paidDate?)` e `unpay(userId, id)`
  - Helper de teste: `createTransaction(app, user, body) → Promise<TransactionDTO>`

- [ ] **Step 1: Acrescentar o helper e escrever o teste que falha**

Acrescente ao fim de `apps/api/test/helpers/factories.ts`:
```ts
export async function createTransaction(app: Express, user: TestUser, body: Record<string, unknown>) {
  const res = await request(app).post('/api/v1/transactions').set(user.auth).send(body);
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as import('@fincontrol/shared').TransactionDTO;
}
```

`apps/api/test/transactions.test.ts`:
```ts
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/app';
import { newUser, type TestUser } from './helpers/auth';
import { resetDb } from './helpers/db';
import { categoryId, createAccount, createTransaction } from './helpers/factories';

const { app } = buildTestApp();

async function setup(user: TestUser) {
  const acc = await createAccount(app, user, { name: 'Corrente', initialBalance: 100000 });
  const savings = await createAccount(app, user, { name: 'Poupança', type: 'savings' });
  const food = await categoryId(app, user, 'Alimentação', 'expense');
  const salary = await categoryId(app, user, 'Salário', 'income');
  const expense = (over: Record<string, unknown> = {}) => ({
    type: 'expense', amount: 5000, description: 'Mercado', accountId: acc.id, categoryId: food, nature: 'variable', dueDate: '2026-11-10', ...over,
  });
  return { acc, savings, food, salary, expense };
}

describe('lançamentos', () => {
  beforeEach(resetDb);

  it('cria despesa pendente com os padrões', async () => {
    const user = await newUser();
    const { expense } = await setup(user);
    const tx = await createTransaction(app, user, expense());
    expect(tx).toMatchObject({ status: 'pending', paidDate: null, recurrenceId: null, overdue: true });
  });

  it('pago sem data de pagamento usa hoje; data futura dá 422', async () => {
    const user = await newUser();
    const { expense } = await setup(user);
    const paid = await createTransaction(app, user, expense({ status: 'paid' }));
    expect(paid.paidDate).toBe('2026-11-11');
    const future = await request(app).post('/api/v1/transactions').set(user.auth).send(expense({ status: 'paid', paidDate: '2026-11-12' }));
    expect(future.status).toBe(422);
  });

  it('valida forma: transferência para a mesma conta, despesa sem categoria, descrição vazia e centavos fracionados', async () => {
    const user = await newUser();
    const { acc, expense } = await setup(user);
    const sameAccount = await request(app).post('/api/v1/transactions').set(user.auth)
      .send({ type: 'transfer', amount: 100, description: 'X', accountId: acc.id, destinationAccountId: acc.id, dueDate: '2026-11-10' });
    expect(sameAccount.status).toBe(400);
    const noCategory = await request(app).post('/api/v1/transactions').set(user.auth).send(expense({ categoryId: null }));
    expect(noCategory.body.errors.map((e: { path: string }) => e.path)).toContain('categoryId');
    const blank = await request(app).post('/api/v1/transactions').set(user.auth).send(expense({ description: '   ' }));
    expect(blank.body.errors.map((e: { path: string }) => e.path)).toContain('description');
    const fraction = await request(app).post('/api/v1/transactions').set(user.auth).send(expense({ amount: 10.5 }));
    expect(fraction.body.errors.map((e: { path: string }) => e.path)).toContain('amount');
  });

  it('categoria de outro tipo dá 422; categoria ou conta de outro usuário dá 404; conta arquivada dá 422', async () => {
    const user = await newUser();
    const { acc, salary, expense } = await setup(user);
    expect((await request(app).post('/api/v1/transactions').set(user.auth).send(expense({ categoryId: salary }))).status).toBe(422);

    const other = await newUser();
    const otherAcc = await createAccount(app, other);
    const otherCat = await categoryId(app, other, 'Lazer', 'expense');
    expect((await request(app).post('/api/v1/transactions').set(user.auth).send(expense({ categoryId: otherCat }))).status).toBe(404);
    expect((await request(app).post('/api/v1/transactions').set(user.auth).send(expense({ accountId: otherAcc.id }))).status).toBe(404);

    await request(app).post(`/api/v1/accounts/${acc.id}/archive`).set(user.auth);
    expect((await request(app).post('/api/v1/transactions').set(user.auth).send(expense())).status).toBe(422);
  });

  it('filtra por tipo, status, conta (inclusive destino), categoria, busca e período', async () => {
    const user = await newUser();
    const { acc, savings, salary, expense } = await setup(user);
    await createTransaction(app, user, expense({ description: 'Mercado do mês', dueDate: '2026-11-05' }));
    await createTransaction(app, user, expense({ description: 'Padaria', dueDate: '2026-10-20', status: 'paid', paidDate: '2026-10-20' }));
    await createTransaction(app, user, { type: 'income', amount: 500000, description: 'Salário', accountId: acc.id, categoryId: salary, nature: 'fixed', dueDate: '2026-11-05' });
    await createTransaction(app, user, { type: 'transfer', amount: 1000, description: 'Reserva', accountId: acc.id, destinationAccountId: savings.id, dueDate: '2026-11-06' });

    const list = (qs: string) => request(app).get(`/api/v1/transactions?${qs}`).set(user.auth).then((r) => r.body.items as { description: string }[]);
    expect(await list('type=income')).toHaveLength(1);
    expect(await list('status=paid')).toHaveLength(1);
    expect((await list(`accountId=${savings.id}`)).map((t) => t.description)).toEqual(['Reserva']);
    expect(await list('q=MERCADO')).toHaveLength(1);
    expect(await list('from=2026-11-01&to=2026-11-30')).toHaveLength(3);
    expect(await list('from=2026-11-01&type=expense')).toHaveLength(1);
  });

  it('pagina por cursor sem repetir nem pular', async () => {
    const user = await newUser();
    const { expense } = await setup(user);
    for (const day of ['01', '02', '02', '03', '04']) await createTransaction(app, user, expense({ dueDate: `2026-11-${day}` }));
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const qs: string = `limit=2${cursor ? `&cursor=${cursor}` : ''}`;
      const res = await request(app).get(`/api/v1/transactions?${qs}`).set(user.auth);
      seen.push(...res.body.items.map((t: { id: string }) => t.id));
      cursor = res.body.nextCursor;
    } while (cursor);
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
  });

  it('cursor inválido dá 400', async () => {
    const user = await newUser();
    const res = await request(app).get('/api/v1/transactions?cursor=lixo').set(user.auth);
    expect(res.status).toBe(400);
    expect(res.body.errors[0].path).toBe('cursor');
  });

  it('pagar e desfazer atualizam o status e o saldo da conta', async () => {
    const user = await newUser();
    const { acc, expense } = await setup(user);
    const tx = await createTransaction(app, user, expense({ amount: 2500 }));
    const paid = await request(app).post(`/api/v1/transactions/${tx.id}/pay`).set(user.auth).send({ paidDate: '2026-11-09' });
    expect(paid.body).toMatchObject({ status: 'paid', paidDate: '2026-11-09', overdue: false });
    const balance = async () => (await request(app).get('/api/v1/accounts').set(user.auth)).body.find((a: { id: string }) => a.id === acc.id).balance;
    expect(await balance()).toBe(97500);
    const undone = await request(app).post(`/api/v1/transactions/${tx.id}/unpay`).set(user.auth);
    expect(undone.body).toMatchObject({ status: 'pending', paidDate: null });
    expect(await balance()).toBe(100000);
  });

  it('edita e exclui', async () => {
    const user = await newUser();
    const { expense } = await setup(user);
    const tx = await createTransaction(app, user, expense());
    const edited = await request(app).patch(`/api/v1/transactions/${tx.id}`).set(user.auth).send({ amount: 7000, description: 'Feira' });
    expect(edited.body).toMatchObject({ amount: 7000, description: 'Feira' });
    expect((await request(app).delete(`/api/v1/transactions/${tx.id}`).set(user.auth)).status).toBe(204);
    expect((await request(app).get('/api/v1/transactions').set(user.auth)).body.items).toHaveLength(0);
  });

  it('editar descrição de lançamento em conta arquivada é permitido (a conta não mudou)', async () => {
    const user = await newUser();
    const { acc, expense } = await setup(user);
    const tx = await createTransaction(app, user, expense());
    await request(app).post(`/api/v1/accounts/${acc.id}/archive`).set(user.auth);
    expect((await request(app).patch(`/api/v1/transactions/${tx.id}`).set(user.auth).send({ description: 'Ajuste' })).status).toBe(200);
  });

  it('isolamento: outro usuário recebe 404 ao editar, excluir ou pagar', async () => {
    const owner = await newUser();
    const intruder = await newUser();
    const { expense } = await setup(owner);
    const tx = await createTransaction(app, owner, expense());
    for (const call of [
      request(app).patch(`/api/v1/transactions/${tx.id}`).set(intruder.auth).send({ description: 'Hack' }),
      request(app).delete(`/api/v1/transactions/${tx.id}`).set(intruder.auth),
      request(app).post(`/api/v1/transactions/${tx.id}/pay`).set(intruder.auth),
      request(app).post(`/api/v1/transactions/${tx.id}/unpay`).set(intruder.auth),
    ]) {
      expect((await call).status).toBe(404);
    }
    expect((await request(app).get('/api/v1/transactions').set(intruder.auth)).body.items).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -w @fincontrol/api -- transactions`
Expected: FAIL, porque a rota `/transactions` não existe.

- [ ] **Step 3: Implementar o repository**

`apps/api/src/modules/transactions/transactions.repository.ts`:
```ts
import type { DateOnly, TransactionNature, TransactionStatus, TransactionType } from '@fincontrol/shared';
import type { Prisma } from '../../generated/prisma/client';
import { fromDateOnly, toDateOnly } from '../../infra/date-mapping';
import type { Db } from '../../infra/prisma';

export type TransactionRow = {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  nature: TransactionNature | null;
  status: TransactionStatus;
  dueDate: DateOnly;
  paidDate: DateOnly | null;
  recurrenceId: string | null;
  occurrenceDate: DateOnly | null;
  createdAt: Date;
};

export type NewTransaction = Omit<TransactionRow, 'id' | 'createdAt'>;

export type TransactionFilters = {
  from?: DateOnly;
  to?: DateOnly;
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  q?: string;
};

export type Cursor = { dueDate: DateOnly; id: string };

type TransactionRecord = Omit<TransactionRow, 'amount' | 'dueDate' | 'paidDate' | 'occurrenceDate'> & {
  amount: bigint;
  dueDate: Date;
  paidDate: Date | null;
  occurrenceDate: Date | null;
};

const optDate = (d: Date | null): DateOnly | null => (d ? toDateOnly(d) : null);
const optDateIn = (d: DateOnly | null): Date | null => (d ? fromDateOnly(d) : null);

export const toTransactionRow = (t: TransactionRecord): TransactionRow => ({
  id: t.id,
  type: t.type,
  amount: Number(t.amount),
  description: t.description,
  accountId: t.accountId,
  destinationAccountId: t.destinationAccountId,
  categoryId: t.categoryId,
  nature: t.nature,
  status: t.status,
  dueDate: toDateOnly(t.dueDate),
  paidDate: optDate(t.paidDate),
  recurrenceId: t.recurrenceId,
  occurrenceDate: optDate(t.occurrenceDate),
  createdAt: t.createdAt,
});

const toCreateData = (userId: string, t: NewTransaction): Prisma.TransactionCreateManyInput => ({
  ...t,
  userId,
  amount: BigInt(t.amount),
  dueDate: fromDateOnly(t.dueDate),
  paidDate: optDateIn(t.paidDate),
  occurrenceDate: optDateIn(t.occurrenceDate),
});

function toUpdateData(p: Partial<NewTransaction>): Prisma.TransactionUncheckedUpdateInput {
  const { amount, dueDate, paidDate, occurrenceDate, ...rest } = p;
  return {
    ...rest,
    ...(amount !== undefined ? { amount: BigInt(amount) } : {}),
    ...(dueDate !== undefined ? { dueDate: fromDateOnly(dueDate) } : {}),
    ...(paidDate !== undefined ? { paidDate: optDateIn(paidDate) } : {}),
    ...(occurrenceDate !== undefined ? { occurrenceDate: optDateIn(occurrenceDate) } : {}),
  };
}

export function createTransactionsRepository(db: Db) {
  return {
    async list(userId: string, f: TransactionFilters, cursor: Cursor | undefined, take: number): Promise<TransactionRow[]> {
      const and: Prisma.TransactionWhereInput[] = [];
      if (f.from) and.push({ dueDate: { gte: fromDateOnly(f.from) } });
      if (f.to) and.push({ dueDate: { lte: fromDateOnly(f.to) } });
      if (f.accountId) and.push({ OR: [{ accountId: f.accountId }, { destinationAccountId: f.accountId }] });
      if (f.categoryId) and.push({ categoryId: f.categoryId });
      if (f.type) and.push({ type: f.type });
      if (f.status) and.push({ status: f.status });
      if (f.q) and.push({ description: { contains: f.q, mode: 'insensitive' } });
      if (cursor) {
        const d = fromDateOnly(cursor.dueDate);
        and.push({ OR: [{ dueDate: { lt: d } }, { dueDate: d, id: { lt: cursor.id } }] });
      }
      const rows = await db.transaction.findMany({
        where: { userId, AND: and },
        orderBy: [{ dueDate: 'desc' }, { id: 'desc' }],
        take,
      });
      return rows.map(toTransactionRow);
    },

    async findById(userId: string, id: string): Promise<TransactionRow | null> {
      const row = await db.transaction.findFirst({ where: { id, userId } });
      return row ? toTransactionRow(row) : null;
    },

    async findByOccurrence(userId: string, recurrenceId: string, occurrenceDate: DateOnly): Promise<TransactionRow | null> {
      const row = await db.transaction.findFirst({ where: { userId, recurrenceId, occurrenceDate: fromDateOnly(occurrenceDate) } });
      return row ? toTransactionRow(row) : null;
    },

    async create(userId: string, t: NewTransaction): Promise<TransactionRow> {
      return toTransactionRow(await db.transaction.create({ data: toCreateData(userId, t) }));
    },

    async update(userId: string, id: string, patch: Partial<NewTransaction>): Promise<TransactionRow> {
      return toTransactionRow(await db.transaction.update({ where: { id, userId }, data: toUpdateData(patch) }));
    },

    async delete(userId: string, id: string): Promise<void> {
      await db.transaction.delete({ where: { id, userId } });
    },

    /** Insere ignorando duplicatas de (recurrence_id, occurrence_date): é a base da materialização idempotente. */
    async insertMany(userId: string, rows: NewTransaction[]): Promise<void> {
      if (rows.length === 0) return;
      await db.transaction.createMany({ data: rows.map((r) => toCreateData(userId, r)), skipDuplicates: true });
    },

    /** Pendentes até `until` em contas não arquivadas, vencimento mais próximo primeiro. */
    async listPendingUntil(userId: string, until: DateOnly, limit: number): Promise<TransactionRow[]> {
      const rows = await db.transaction.findMany({
        where: { userId, status: 'pending', dueDate: { lte: fromDateOnly(until) }, account: { archivedAt: null } },
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
        take: limit,
      });
      return rows.map(toTransactionRow);
    },
  };
}

export type TransactionsRepository = ReturnType<typeof createTransactionsRepository>;
```

- [ ] **Step 4: Implementar o mapper, as referências e o cursor**

`apps/api/src/modules/transactions/transactions.mapper.ts`:
```ts
import type { DateOnly, TransactionDTO } from '@fincontrol/shared';
import type { TransactionRow } from './transactions.repository';

export function toTransactionDTO(row: TransactionRow, today: DateOnly): TransactionDTO {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    description: row.description,
    accountId: row.accountId,
    destinationAccountId: row.destinationAccountId,
    categoryId: row.categoryId,
    nature: row.nature,
    status: row.status,
    dueDate: row.dueDate,
    paidDate: row.paidDate,
    recurrenceId: row.recurrenceId,
    occurrenceDate: row.occurrenceDate,
    overdue: row.status === 'pending' && row.dueDate < today,
    createdAt: row.createdAt.toISOString(),
  };
}
```

`apps/api/src/modules/transactions/transactions.refs.ts`:
```ts
import { transactionShapeIssues, type ShapeInput } from '@fincontrol/shared';
import { ValidationError } from '../../http/errors';
import type { AccountsService } from '../accounts/accounts.service';
import type { CategoriesService } from '../categories/categories.service';

export type RefsCheck = { account?: boolean; destination?: boolean; category?: boolean };
export type ValidateRefs = (userId: string, t: ShapeInput, check?: RefsCheck) => Promise<void>;

/** Valida a forma e se as contas e a categoria pertencem ao usuário. Só checa o que mudou (check). */
export function createRefsValidator(accounts: AccountsService, categories: CategoriesService): ValidateRefs {
  return async (userId, t, check = { account: true, destination: true, category: true }) => {
    const issues = transactionShapeIssues(t);
    if (issues.length > 0) throw new ValidationError(issues);
    if (check.account) await accounts.assertUsable(userId, t.accountId);
    if (check.destination && t.destinationAccountId) await accounts.assertUsable(userId, t.destinationAccountId);
    if (check.category && t.categoryId && t.type !== 'transfer') await categories.assertMatches(userId, t.categoryId, t.type);
  };
}
```

`apps/api/src/modules/transactions/transactions.cursor.ts`:
```ts
import { idSchema, isValidDateOnly } from '@fincontrol/shared';
import { ValidationError } from '../../http/errors';
import type { Cursor, TransactionRow } from './transactions.repository';

export function encodeCursor(row: Pick<TransactionRow, 'dueDate' | 'id'>): string {
  return Buffer.from(`${row.dueDate}|${row.id}`, 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): Cursor {
  const [dueDate, id] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
  if (!dueDate || !id || !isValidDateOnly(dueDate) || !idSchema.safeParse(id).success) {
    throw new ValidationError([{ path: 'cursor', message: 'Cursor inválido' }]);
  }
  return { dueDate, id };
}
```

- [ ] **Step 5: Implementar o service e as rotas**

`apps/api/src/modules/transactions/transactions.service.ts`:
```ts
import {
  todayInSaoPaulo,
  type CreateTransactionInput, type DateOnly, type ListTransactionsQuery, type ShapeInput,
  type TransactionDTO, type TransactionPage, type TransactionStatus, type UpdateTransactionInput,
} from '@fincontrol/shared';
import { NotFoundError, UnprocessableError } from '../../http/errors';
import { decodeCursor, encodeCursor } from './transactions.cursor';
import { toTransactionDTO } from './transactions.mapper';
import type { ValidateRefs } from './transactions.refs';
import type { TransactionRow, TransactionsRepository } from './transactions.repository';

export type TransactionsServiceDeps = {
  repo: TransactionsRepository;
  validateRefs: ValidateRefs;
  clock: () => Date;
};

export function createTransactionsService(deps: TransactionsServiceDeps) {
  const { repo, validateRefs } = deps;
  const today = () => todayInSaoPaulo(deps.clock());

  async function getOwned(userId: string, id: string): Promise<TransactionRow> {
    const tx = await repo.findById(userId, id);
    if (!tx) throw new NotFoundError('Lançamento');
    return tx;
  }

  function resolvePaidDate(status: TransactionStatus, paidDate: DateOnly | null | undefined): DateOnly | null {
    if (status === 'pending') return null;
    const t = today();
    const date = paidDate ?? t;
    if (date > t) throw new UnprocessableError('A data de pagamento não pode estar no futuro.');
    return date;
  }

  return {
    async create(userId: string, input: CreateTransactionInput): Promise<TransactionDTO> {
      await validateRefs(userId, input);
      const row = await repo.create(userId, {
        type: input.type,
        amount: input.amount,
        description: input.description,
        accountId: input.accountId,
        destinationAccountId: input.destinationAccountId,
        categoryId: input.categoryId,
        nature: input.nature,
        status: input.status,
        dueDate: input.dueDate,
        paidDate: resolvePaidDate(input.status, input.paidDate),
        recurrenceId: null,
        occurrenceDate: null,
      });
      return toTransactionDTO(row, today());
    },

    async list(userId: string, q: ListTransactionsQuery): Promise<TransactionPage> {
      const cursor = q.cursor ? decodeCursor(q.cursor) : undefined;
      const { cursor: _c, limit, ...filters } = q;
      const rows = await repo.list(userId, filters, cursor, limit + 1);
      const page = rows.slice(0, limit);
      const last = page.at(-1);
      return {
        items: page.map((r) => toTransactionDTO(r, today())),
        nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
      };
    },

    async update(userId: string, id: string, input: UpdateTransactionInput): Promise<TransactionDTO> {
      const current = await getOwned(userId, id);
      const merged: ShapeInput = {
        type: current.type,
        accountId: input.accountId ?? current.accountId,
        destinationAccountId: input.destinationAccountId !== undefined ? input.destinationAccountId : current.destinationAccountId,
        categoryId: input.categoryId !== undefined ? input.categoryId : current.categoryId,
        nature: input.nature !== undefined ? input.nature : current.nature,
      };
      await validateRefs(userId, merged, {
        account: input.accountId !== undefined,
        destination: input.destinationAccountId !== undefined,
        category: input.categoryId !== undefined,
      });
      const { recurrence: _recurrence, ...fields } = input;
      return toTransactionDTO(await repo.update(userId, id, fields), today());
    },

    async remove(userId: string, id: string): Promise<void> {
      await getOwned(userId, id);
      await repo.delete(userId, id);
    },

    async pay(userId: string, id: string, paidDate?: DateOnly): Promise<TransactionDTO> {
      await getOwned(userId, id);
      const row = await repo.update(userId, id, { status: 'paid', paidDate: resolvePaidDate('paid', paidDate) });
      return toTransactionDTO(row, today());
    },

    async unpay(userId: string, id: string): Promise<TransactionDTO> {
      await getOwned(userId, id);
      return toTransactionDTO(await repo.update(userId, id, { status: 'pending', paidDate: null }), today());
    },
  };
}

export type TransactionsService = ReturnType<typeof createTransactionsService>;
```

`apps/api/src/modules/transactions/transactions.routes.ts`:
```ts
import {
  createTransactionSchema, idSchema, listTransactionsQuerySchema, paySchema, updateTransactionSchema,
} from '@fincontrol/shared';
import { Router } from 'express';
import { userIdOf } from '../../http/auth';
import { parse } from '../../http/validate';
import type { TransactionsService } from './transactions.service';

export function transactionsRouter(service: TransactionsService): Router {
  const r = Router();
  r.get('/', async (req, res) => {
    res.json(await service.list(userIdOf(res), parse(listTransactionsQuerySchema, req.query)));
  });
  r.post('/', async (req, res) => {
    res.status(201).json(await service.create(userIdOf(res), parse(createTransactionSchema, req.body)));
  });
  r.patch('/:id', async (req, res) => {
    res.json(await service.update(userIdOf(res), parse(idSchema, req.params.id), parse(updateTransactionSchema, req.body)));
  });
  r.delete('/:id', async (req, res) => {
    await service.remove(userIdOf(res), parse(idSchema, req.params.id));
    res.status(204).end();
  });
  r.post('/:id/pay', async (req, res) => {
    const { paidDate } = parse(paySchema, req.body ?? {});
    res.json(await service.pay(userIdOf(res), parse(idSchema, req.params.id), paidDate));
  });
  r.post('/:id/unpay', async (req, res) => {
    res.json(await service.unpay(userIdOf(res), parse(idSchema, req.params.id)));
  });
  return r;
}
```

- [ ] **Step 6: Registrar**

Em `apps/api/src/http/container.ts`, acrescente os imports:
```ts
import { createRefsValidator } from '../modules/transactions/transactions.refs';
import { createTransactionsRepository } from '../modules/transactions/transactions.repository';
import { createTransactionsService } from '../modules/transactions/transactions.service';
```
e troque o `return` por:
```ts
  const transactionsRepo = createTransactionsRepository(deps.db);
  const validateRefs = createRefsValidator(accounts, categories);
  const transactions = createTransactionsService({ repo: transactionsRepo, validateRefs, clock: deps.clock });
  return { provisioner, profile, accountsRepo, accounts, categoriesRepo, categories, transactionsRepo, validateRefs, transactions };
```

Em `apps/api/src/http/routes.ts`, acrescente o import `import { transactionsRouter } from '../modules/transactions/transactions.routes';` e a linha:
```ts
  api.use('/transactions', transactionsRouter(c.transactions));
```

- [ ] **Step 7: Rodar os testes**

Run: `npm test -w @fincontrol/api && npm run lint && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api
git commit -m "feat(api): lançamentos com filtros, paginação por cursor, pagamento e validação de referências"
```

---

<!-- CONTINUA-PARTE-C -->
