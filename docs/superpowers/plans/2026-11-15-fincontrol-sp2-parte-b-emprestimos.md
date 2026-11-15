# Sub-projeto 2, Parte B: empréstimos e financiamentos — plano de implementação

> **Para agentes:** sub-skill obrigatória: `superpowers:subagent-driven-development` (recomendada) ou `superpowers:executing-plans`. Os passos usam checkbox (`- [ ]`).

**Objetivo:** a pessoa cadastra um empréstimo com o que ela sabe (valor recebido, parcela e número de parcelas) e o app mostra:
- a taxa de juros real, ao mês e ao ano;
- quanto ela vai devolver e quanto disso é juros;
- o saldo devedor e a quitação antecipada estimada;
- a comparação com as taxas oficiais do banco e do mercado, publicadas pelo Banco Central.

As parcelas entram no livro-caixa e no indicador "Comprometimento de renda".

**Arquitetura:**
- **Matemática:** funções puras em `packages/shared/src/loan.ts`, como `card.ts`. A web usa as mesmas funções na prévia do formulário.
- **Empréstimo:** é a tabela `loans`. As parcelas restantes são lançamentos pendentes comuns, ligados por `loanId` (C10).
- **Taxas do Banco Central:** são sincronizadas por um cron e guardadas em `bank_rates`. Um cliente HTTP isolado e testado com respostas gravadas faz a leitura.

**Stack:** Express 5, Prisma 7 (PostgreSQL), Zod 4 (`packages/shared`), React 19 + TanStack Query, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-12-fincontrol-sp2-credito-design.md` (decisões C8–C13; seções 3 a 11, só a Parte B).

## Leitura da API do Banco Central (feita em 2026-11-15)

A spec manda ler as modalidades oficiais antes de fixar qualquer nome (seção 5). O resultado muda dois pontos da spec, marcados como **D1** a **D6** abaixo. Cada desvio precisa do aceite do usuário antes da execução.

- **Serviço:** `https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/`. Os conjuntos são `TaxasJurosMensalPorMes`, `TaxasJurosDiariaPorInicioPeriodo`, `ParametrosConsulta`, `ConsultaUnificada` e `ConsultaDatas`.
- **`TaxasJurosMensalPorMes` só traz financiamento imobiliário** (6 modalidades). Campos: `Mes` ("Set-2026"), `anoMes` ("2026-09"), `Modalidade`, `Posicao`, `InstituicaoFinanceira`, `TaxaJurosAoMes`, `TaxaJurosAoAno`, `cnpj8`.
- **As outras modalidades de pessoa física estão em `TaxasJurosDiariaPorInicioPeriodo`.** As taxas são médias de 5 dias úteis, publicadas por semana. Campos: `InicioPeriodo`, `FimPeriodo`, `Segmento`, `Modalidade`, `Posicao`, `InstituicaoFinanceira`, `TaxaJurosAoMes`, `TaxaJurosAoAno`, `cnpj8`.
  - O período mais recente em 2026-11-15 era de 2026-10-23 a 2026-10-29, cerca de 3 semanas de atraso.
- **As taxas vêm em percentual** (`1.12` = 1,12% ao mês). Há instituição com `0.0` (promoção), e há outra com mais de 20% ao mês.
- **Modalidades de pessoa física (nomes exatos):**
  - Aquisição de outros bens - Prefixado
  - Aquisição de veículos - Prefixado
  - Cartão de crédito - parcelado - Prefixado
  - Cartão de crédito - rotativo total - Prefixado
  - Cheque especial - Prefixado
  - Crédito pessoal consignado INSS - Prefixado
  - Crédito pessoal consignado privado - Prefixado
  - Crédito pessoal consignado público - Prefixado
  - Crédito pessoal não consignado - Prefixado
  - Desconto de cheques - Prefixado
- **Imobiliário:** "Financiamento imobiliário com taxas de mercado - Prefixado", além de variantes pós-fixadas (IPCA, TR) e de taxas reguladas.
- **Consulta:** o `$filter` precisa dos espaços codificados como `%20` (`encodeURIComponent`). Com `+`, a API responde "The URI is malformed". O JSON vem em UTF-8 correto.
- **Respostas gravadas** para os testes, já no repositório:
  - `apps/api/test/fixtures/bcb-veiculos-2026-10-23.json`: 39 bancos, com o Banco do Brasil (`00000000`) em 7º, a 1,12% ao mês. A mediana é 1,70% ao mês.
  - `apps/api/test/fixtures/bcb-imobiliario-2026-09.json`: 4 bancos, com a Caixa a 0,87% ao mês.

## Desvios da spec (precisam do aceite do usuário)

- **D1. Duas fontes, não uma.** Imobiliário vem de `TaxasJurosMensalPorMes`, e o resto de `TaxasJurosDiariaPorInicioPeriodo`. A tabela `bank_rates` guarda o período (`periodStart`, `periodEnd`) no lugar de `month`. Ela mantém só o período mais recente de cada modalidade, porque o app só compara com o dado atual.
- **D2. Consignado vira três tipos**, porque o Banco Central separa INSS, servidor público e privado. O enum `LoanKind` fica `personal | payroll_inss | payroll_public | payroll_private | vehicle | mortgage | other`. O tipo `other` não tem comparação.
- **D3. "Mercado" = mediana das instituições, não média.** A lista tem extremos (0% e mais de 20% ao mês) que puxariam a média. A tela escreve "mediana do mercado".
- **D4. Cron semanal** (segunda, 07:00 UTC), não mensal, porque o dado de pessoa física sai por semana.
- **D5. Demo:** o financiamento tem "já paguei 6" no cadastro e mais 6 parcelas pagas dentro dos 6 meses de histórico, o que dá 12 pagas, como na spec. Assim as parcelas aparecem no fluxo de caixa da demo.
- **D6. As funções de empréstimo ficam em `packages/shared/src/loan.ts`**, e não em `apps/api/src/domain/`, porque a prévia do formulário usa as mesmas contas. A Parte A fez o mesmo com `card.ts`.

## Restrições globais

- Dinheiro sempre em centavos inteiros (`BigInt` no banco, `number` no TS).
- Datas como `DateOnly` (`AAAA-MM-DD`), com os helpers de `packages/shared/src/dates.ts` (`addMonthsToYm`, `dateInMonth`, `monthOf`).
- Taxas na API e na web como **fração** (0,0186 = 1,86% ao mês), com o mesmo padrão de `debtCommitment`. No banco ficam como o Banco Central publica, em percentual `Decimal(9,4)`.
- Todo texto de interface em pt-BR. Situação e alerta sempre com ícone e texto.
- Toda estimativa vem rotulada como estimativa (C11). A comparação mostra a fonte ("Banco Central do Brasil") e o período de referência.
- TDD: o teste falha primeiro. Testes de API rodam contra o Postgres real (`npm run db:up`). **Nenhum teste acessa a rede**: o `fetch` do cliente do Banco Central é injetado.
- Toda rota filtra por `userId`, e recurso de outro usuário dá 404.
- Commits convencionais em pt-BR, um por tarefa.
- Gates no fim de cada tarefa: `npm run lint`, `npm run typecheck` e `npm test`. E2E nas tarefas 8 e 11.

## Foco de revisão

1. **Parcela × n ≤ valor recebido** (sem juros ou com desconto): a taxa é 0, não há divisão por zero, e o saldo devedor = parcela × restantes (Tarefa 1).
2. **"Já paguei" igual ao total ou maior** dá 422. Já paguei = total − 1 gera exatamente 1 parcela (Tarefa 6).
3. **Banco Central fora do ar ou com resposta vazia:** a sincronização não apaga os dados anteriores (Tarefa 5).
4. **Excluir o empréstimo:** apaga as parcelas pendentes, mantém as pagas sem o vínculo e não mexe em lançamentos de outro empréstimo (Tarefa 6).
5. **Barra de navegação com 6 itens a 360 px:** sem rolagem horizontal (Tarefas 9 e 11).

---

### Tarefa 1: matemática do empréstimo (shared)

**Arquivos:**
- Criar: `packages/shared/src/loan.ts` e `packages/shared/src/loan.test.ts`
- Modificar: `packages/shared/src/index.ts` (`export * from './loan';`)

**Interfaces:**
- Produz:
  - `impliedMonthlyRate(principal: number, installment: number, n: number): number` (fração);
  - `annualRate(monthly: number): number`;
  - `outstandingBalance(installment: number, monthly: number, remaining: number): number` (centavos, arredondado);
  - `loanSummary(i: { principal; installmentAmount; installmentsTotal; installmentsPaid }): LoanSummary`;
  - `loanWarnings(i: { monthlyRate; informedMonthlyRate: number | null; kind: string }): LoanWarning[]`;
  - `LoanSummary = { monthlyRate, annualRate, totalCost, interest, paidAmount, remainingCount, outstanding, payoffSavings }`;
  - `LoanWarning = 'informed_rate_differs' | 'rate_too_high' | 'sac_approximate'`.

- [ ] **Passo 1: teste que falha**

```ts
import { describe, expect, it } from 'vitest';
import { annualRate, impliedMonthlyRate, loanSummary, loanWarnings, outstandingBalance } from './loan';

describe('impliedMonthlyRate', () => {
  it('R$ 10.000 em 24x de R$ 600 → 3,15% a.m. (critério de aceite 4)', () => {
    expect(impliedMonthlyRate(1000000, 60000, 24)).toBeCloseTo(0.03149127, 7);
  });
  it('R$ 30.000 em 48x de R$ 950 → 1,858% a.m.', () => {
    expect(impliedMonthlyRate(3000000, 95000, 48)).toBeCloseTo(0.0185795, 6);
  });
  it('parcela × n ≤ valor recebido → taxa 0, sem divisão por zero', () => {
    expect(impliedMonthlyRate(100000, 1000, 100)).toBe(0);
    expect(impliedMonthlyRate(100000, 900, 100)).toBe(0);
  });
});

describe('annualRate', () => {
  it('é (1+i)^12 − 1', () => expect(annualRate(0.0185795)).toBeCloseTo(0.247209, 5));
});

describe('outstandingBalance', () => {
  it('valor presente das restantes à taxa real', () => {
    expect(outstandingBalance(95000, impliedMonthlyRate(3000000, 95000, 48), 36)).toBe(2477608);
  });
  it('taxa 0 → parcela × restantes', () => expect(outstandingBalance(1000, 0, 7)).toBe(7000));
  it('nenhuma restante → 0', () => expect(outstandingBalance(95000, 0.02, 0)).toBe(0));
});

describe('loanSummary', () => {
  it('critério 4: total R$ 14.400 e juros R$ 4.400', () => {
    const s = loanSummary({ principal: 1000000, installmentAmount: 60000, installmentsTotal: 24, installmentsPaid: 0 });
    expect(s).toMatchObject({ totalCost: 1440000, interest: 440000, paidAmount: 0, remainingCount: 24, outstanding: 1000000 });
    expect(Math.round(s.monthlyRate * 10000) / 100).toBe(3.15); // "3,15% ao mês" com 2 casas
  });
  it('critério 5: 12 de 48 pagas → saldo devedor e economia na quitação', () => {
    const s = loanSummary({ principal: 3000000, installmentAmount: 95000, installmentsTotal: 48, installmentsPaid: 12 });
    expect(s).toMatchObject({ paidAmount: 1140000, remainingCount: 36, outstanding: 2477608, payoffSavings: 942392 });
  });
});

describe('loanWarnings', () => {
  it('taxa informada difere mais de 0,1 p.p. ao mês', () => {
    expect(loanWarnings({ monthlyRate: 0.0315, informedMonthlyRate: 0.0299, kind: 'personal' })).toEqual(['informed_rate_differs']);
    expect(loanWarnings({ monthlyRate: 0.0315, informedMonthlyRate: 0.0310, kind: 'personal' })).toEqual([]);
  });
  it('acima de 30% ao mês sugere erro de digitação', () => {
    expect(loanWarnings({ monthlyRate: 0.31, informedMonthlyRate: null, kind: 'personal' })).toEqual(['rate_too_high']);
  });
  it('financiamento imobiliário avisa que a taxa é aproximada (C9, SAC)', () => {
    expect(loanWarnings({ monthlyRate: 0.009, informedMonthlyRate: null, kind: 'mortgage' })).toEqual(['sac_approximate']);
  });
});
```

- [ ] **Passo 2:** `npx vitest run src/loan.test.ts` dentro de `packages/shared`. Esperado: FAIL ("Failed to resolve import ./loan").
- [ ] **Passo 3: implementar**

```ts
/**
 * Empréstimos em tabela Price (spec C8, C9 e C11). Valores em centavos; taxas como fração (0,02 = 2% ao mês).
 * Referência: skills `lending` e `time-value-of-money`.
 */
export type LoanWarning = 'informed_rate_differs' | 'rate_too_high' | 'sac_approximate';
export type LoanSummary = {
  monthlyRate: number; annualRate: number; totalCost: number; interest: number;
  paidAmount: number; remainingCount: number; outstanding: number; payoffSavings: number;
};

const presentValue = (installment: number, i: number, n: number) => (i === 0 ? installment * n : (installment * (1 - (1 + i) ** -n)) / i);

/** Taxa mensal que faz `principal = PV(parcela, i, n)`. Bisseção em [0, 100% a.m.], precisão de 1e-10; sem juros → 0. */
export function impliedMonthlyRate(principal: number, installment: number, n: number): number {
  if (installment * n <= principal) return 0;
  let lo = 0;
  let hi = 1;
  while (hi - lo > 1e-10) {
    const mid = (lo + hi) / 2;
    if (presentValue(installment, mid, n) > principal) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export const annualRate = (monthly: number) => (1 + monthly) ** 12 - 1;

/** Saldo devedor = quitação estimada (CDC art. 52 §2º): valor presente das parcelas restantes. */
export function outstandingBalance(installment: number, monthly: number, remaining: number): number {
  return remaining <= 0 ? 0 : Math.round(presentValue(installment, monthly, remaining));
}

export function loanSummary(l: { principal: number; installmentAmount: number; installmentsTotal: number; installmentsPaid: number }): LoanSummary {
  const monthlyRate = impliedMonthlyRate(l.principal, l.installmentAmount, l.installmentsTotal);
  const totalCost = l.installmentAmount * l.installmentsTotal;
  const remainingCount = Math.max(l.installmentsTotal - l.installmentsPaid, 0);
  const outstanding = outstandingBalance(l.installmentAmount, monthlyRate, remainingCount);
  return {
    monthlyRate, annualRate: annualRate(monthlyRate), totalCost, interest: totalCost - l.principal,
    paidAmount: l.installmentAmount * l.installmentsPaid, remainingCount, outstanding,
    payoffSavings: l.installmentAmount * remainingCount - outstanding,
  };
}

/** Avisos do cadastro (spec C8, C9 e seção 8). */
export function loanWarnings(i: { monthlyRate: number; informedMonthlyRate: number | null; kind: string }): LoanWarning[] {
  const out: LoanWarning[] = [];
  if (i.informedMonthlyRate !== null && Math.abs(i.monthlyRate - i.informedMonthlyRate) > 0.001) out.push('informed_rate_differs');
  if (i.monthlyRate > 0.3) out.push('rate_too_high');
  if (i.kind === 'mortgage') out.push('sac_approximate');
  return out;
}
```

- [ ] **Passo 4:** PASS. **Passo 5:** `git commit -m "feat(shared): taxa real, saldo devedor e quitação de empréstimos (domínio)"`

### Tarefa 2: cliente do Banco Central e correspondência tipo → modalidade

**Arquivos:**
- Criar: `apps/api/src/infra/bcb-client.ts` e `apps/api/src/infra/bcb-client.test.ts`
- Criar: `apps/api/src/domain/loan-modalities.ts` e `apps/api/src/domain/loan-modalities.test.ts`
- Usar: os fixtures já gravados em `apps/api/test/fixtures/`

**Interfaces:**
- Produz:
  - `MODALITY_BY_KIND: Record<LoanKind, BcbModality | null>`, com `BcbModality = { name: string; source: 'weekly' | 'monthly' }`;
  - `createBcbClient(fetchFn: typeof fetch = fetch)` com `latestRates(m: BcbModality): Promise<BcbPeriodRates | null>`;
  - `BcbPeriodRates = { modality: string; periodStart: DateOnly; periodEnd: DateOnly; rows: { cnpj8: string; institution: string; monthlyRate: number; annualRate: number; position: number }[] }`. `monthlyRate`/`annualRate` vêm em **percentual**, como o Banco Central publica.

- [ ] **Passo 1: testes que falham**

```ts
// loan-modalities.test.ts
import { describe, expect, it } from 'vitest';
import { MODALITY_BY_KIND } from './loan-modalities';

describe('MODALITY_BY_KIND (nomes lidos da API em 2026-11-15)', () => {
  it('fixa a modalidade de cada tipo', () => {
    expect(MODALITY_BY_KIND).toEqual({
      personal: { name: 'Crédito pessoal não consignado - Prefixado', source: 'weekly' },
      payroll_inss: { name: 'Crédito pessoal consignado INSS - Prefixado', source: 'weekly' },
      payroll_public: { name: 'Crédito pessoal consignado público - Prefixado', source: 'weekly' },
      payroll_private: { name: 'Crédito pessoal consignado privado - Prefixado', source: 'weekly' },
      vehicle: { name: 'Aquisição de veículos - Prefixado', source: 'weekly' },
      mortgage: { name: 'Financiamento imobiliário com taxas de mercado - Prefixado', source: 'monthly' },
      other: null,
    });
  });
});
```

```ts
// bcb-client.test.ts
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { MODALITY_BY_KIND } from '../domain/loan-modalities';
import { createBcbClient } from './bcb-client';

const fixture = (name: string) => readFileSync(new URL(`../../test/fixtures/${name}`, import.meta.url), 'utf8');
const ok = (body: string) => new Response(body, { status: 200, headers: { 'content-type': 'application/json;charset=UTF-8' } });

describe('createBcbClient', () => {
  it('semanal: descobre o período mais recente e lê as taxas dele', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(ok(JSON.stringify({ value: [{ InicioPeriodo: '2026-10-23', FimPeriodo: '2026-10-29' }] })))
      .mockResolvedValueOnce(ok(fixture('bcb-veiculos-2026-10-23.json')));
    const r = await createBcbClient(fetchFn).latestRates(MODALITY_BY_KIND.vehicle!);
    expect(r).toMatchObject({ modality: 'Aquisição de veículos - Prefixado', periodStart: '2026-10-23', periodEnd: '2026-10-29' });
    expect(r!.rows).toHaveLength(39);
    expect(r!.rows.find((x) => x.cnpj8 === '00000000')).toEqual({ cnpj8: '00000000', institution: 'BCO DO BRASIL S.A.', monthlyRate: 1.12, annualRate: 14.25, position: 7 });
    // Espaços codificados como %20 (com "+" a API responde "The URI is malformed").
    expect(String(fetchFn.mock.calls[1]![0])).toContain('Aquisi%C3%A7%C3%A3o%20de%20ve%C3%ADculos');
  });

  it('mensal (imobiliário): período = o mês inteiro de `anoMes`', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(ok(JSON.stringify({ value: [{ anoMes: '2026-09' }] })))
      .mockResolvedValueOnce(ok(fixture('bcb-imobiliario-2026-09.json')));
    const r = await createBcbClient(fetchFn).latestRates(MODALITY_BY_KIND.mortgage!);
    expect(r).toMatchObject({ periodStart: '2026-09-01', periodEnd: '2026-09-30' });
    expect(r!.rows.map((x) => x.institution)).toContain('CAIXA ECONOMICA FEDERAL');
  });

  it('sem dados → null; HTTP de erro → lança', async () => {
    expect(await createBcbClient(vi.fn().mockResolvedValue(ok('{"value":[]}'))).latestRates(MODALITY_BY_KIND.personal!)).toBeNull();
    await expect(createBcbClient(vi.fn().mockResolvedValue(new Response('x', { status: 503 }))).latestRates(MODALITY_BY_KIND.personal!)).rejects.toThrow(/503/);
  });
});
```

- [ ] **Passo 2:** `npx vitest run src/infra/bcb-client.test.ts src/domain/loan-modalities.test.ts` em `apps/api`. Esperado: FAIL.
- [ ] **Passo 3: implementar**
  - **`loan-modalities.ts`:** o objeto acima, tipado com `LoanKind` da Tarefa 3. Até essa tarefa existir, declare o tipo localmente e troque pelo import na Tarefa 3.
  - **`bcb-client.ts`:**
    - base `https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/`;
    - query montada com `encodeURIComponent` em cada valor (`$format=json`, `$filter`, `$orderby`, `$top`, `$select`). Nunca use `URLSearchParams`, que troca espaço por `+`;
    - **semanal:**
      1. `TaxasJurosDiariaPorInicioPeriodo` com `$filter=Modalidade eq '<nome>'`, `$orderby=InicioPeriodo desc`, `$top=1` e `$select=InicioPeriodo,FimPeriodo`;
      2. o mesmo conjunto com `$filter=Modalidade eq '<nome>' and InicioPeriodo eq '<início>'` e `$top=500`;
    - **mensal:**
      1. `TaxasJurosMensalPorMes` com `$orderby=anoMes desc`, `$top=1` e `$select=anoMes`;
      2. `$filter=Modalidade eq '<nome>' and anoMes eq '<AAAA-MM>'`. O período vai de `startOfMonth` a `endOfMonth` do `anoMes`;
    - `!res.ok` → `throw new Error(\`Banco Central respondeu ${res.status}\`)`. Lista vazia → `null`;
    - timeout de 20 s com `AbortSignal.timeout(20_000)`.
- [ ] **Passo 4:** PASS. **Passo 5:** `git commit -m "feat(api): cliente das taxas do Banco Central e modalidade por tipo de empréstimo"`

### Tarefa 3: contratos compartilhados (Zod e DTOs)

**Arquivos:**
- Criar: `packages/shared/src/schemas/loans.ts`
- Modificar:
  - `packages/shared/src/schemas/index.ts`;
  - `packages/shared/src/schemas/transactions.ts` (`TransactionDTO.loanId: string | null`);
  - `packages/shared/src/schemas/schemas.test.ts`.

**Interfaces:**
- Produz:
  - `loanKindSchema = z.enum(['personal', 'payroll_inss', 'payroll_public', 'payroll_private', 'vehicle', 'mortgage', 'other'])` e `type LoanKind`;
  - `LOAN_KIND_LABELS: Record<LoanKind, string>`: "Crédito pessoal", "Consignado INSS", "Consignado servidor público", "Consignado privado (CLT)", "Financiamento de veículo", "Financiamento imobiliário" e "Outro";
  - `createLoanSchema` com os campos:
    - `name` (1–80);
    - `kind`;
    - `bankName` (1–80);
    - `bankCnpj8` (`/^\d{8}$/`, opcional);
    - `principal` e `installmentAmount` (centavos inteiros > 0);
    - `installmentsTotal` (1–480);
    - `installmentsPaidBefore` (≥ 0, default 0);
    - `firstDueDate` (`dateOnlySchema`);
    - `accountId` (uuid);
    - `informedMonthlyRate` (fração em (0, 1], opcional).

    Com um `superRefine`: `installmentsPaidBefore >= installmentsTotal` → issue em `installmentsPaidBefore`, "Já pagas precisa ser menor que o total de parcelas".
  - `updateLoanSchema = z.object({ name })`;
  - `LoanDTO`:
    - `id`, `name`, `kind`, `bankName`, `bankCnpj8`;
    - `principal`, `installmentAmount`, `installmentsTotal` e `installmentsPaid` (= antes + pagas no app);
    - `monthlyRate`, `annualRate`, `outstanding`;
    - `nextDue: { date, amount } | null`;
  - `LoanDetailDTO = LoanDTO & LoanSummary & { warnings: LoanWarning[]; informedMonthlyRate: number | null; comparison: LoanComparisonDTO | null }`;
  - `LoanComparisonDTO`:
    - `modality`, `periodStart`, `periodEnd` e `source: 'Banco Central do Brasil'`;
    - `bank: { name; monthlyRate; annualRate; position; of } | null`;
    - `market: { monthlyRate; annualRate }` (mediana, D3).

    Todas as taxas em fração.
  - `BankDTO = { cnpj8: string; name: string }`.

- [ ] **Passo 1: testes que falham** (em `schemas.test.ts`)
  - `createLoanSchema` aceita o exemplo da demo (`principal: 3000000`, `installmentAmount: 95000`, `installmentsTotal: 48`, `installmentsPaidBefore: 6`, `kind: 'vehicle'`, `bankCnpj8: '00000000'`).
  - `installmentsPaidBefore: 48` com total 48 → falha no caminho `installmentsPaidBefore`. 47 passa.
  - `installmentAmount: 0` falha. `bankCnpj8: '123'` falha.
- [ ] **Passos 2 a 4:** implementar no estilo dos schemas atuais (`fields` + `z.object`) e rodar `npm test -w @fincontrol/shared` até PASS. Na Tarefa 2, troque o tipo local pelo `LoanKind` daqui.
- [ ] **Passo 5:** `git commit -m "feat(shared): contratos de empréstimos, bancos e comparação de taxas"`

### Tarefa 4: migration do Prisma

**Arquivos:**
- Modificar: `apps/api/prisma/schema.prisma`
- Gerado: `apps/api/prisma/migrations/<timestamp>_emprestimos/migration.sql`
- Modificar: `apps/api/src/modules/profile/default-categories.ts` e `apps/web/src/features/categories/icons.ts`

**O que muda:**
- **`enum LoanKind`:** com os 7 valores da Tarefa 3.
- **`model Loan` (`loans`):**
  - `id`, `userId` (FK `profiles`, `onDelete: Cascade`), `name`, `kind`, `bankName`, `bankCnpj8 String? @db.Char(8)`;
  - `principal BigInt`, `installmentAmount BigInt`, `installmentsTotal Int`, `installmentsPaidBefore Int @default(0)`;
  - `firstDueDate @db.Date`, `accountId` (FK `accounts`, `onDelete: NoAction`), `informedMonthlyRate Decimal? @db.Decimal(9,6)` (fração);
  - `createdAt`, `updatedAt`, `transactions Transaction[]`, `@@index([userId])`.
- **`model BankRate` (`bank_rates`):**
  - `id`, `modality`, `periodStart @db.Date`, `periodEnd @db.Date`, `institution`, `cnpj8 @db.Char(8)`;
  - `monthlyRate Decimal @db.Decimal(9,4)` e `annualRate Decimal @db.Decimal(9,4)` (percentual);
  - `position Int`, `syncedAt @default(now())`;
  - `@@unique([modality, cnpj8])` (D1: só o período atual) e `@@index([cnpj8])`.
- **`Transaction.loanId`:** `String? @db.Uuid`, FK `loans` com `onDelete: SetNull`, e `@@index([loanId])`.
- **SQL acrescentado à mão no `migration.sql`:**
  - `ALTER TABLE "loans" ENABLE ROW LEVEL SECURITY;` e o mesmo para `"bank_rates"`, no padrão de `20261111062026_rls_e_constraints`;
  - `CHECK` com `principal > 0`, `installment_amount > 0`, `installments_total BETWEEN 1 AND 480` e `installments_paid_before >= 0 AND installments_paid_before < installments_total`;
  - a categoria nova para os perfis existentes:
    `INSERT INTO "categories" ("id","user_id","name","type","icon","color","created_at","updated_at") SELECT gen_random_uuid(), "id", 'Empréstimos e financiamentos', 'expense', 'landmark', '#0f766e', now(), now() FROM "profiles" ON CONFLICT ("user_id","type","name") DO NOTHING;`
- **`DEFAULT_CATEGORIES`:** ganha `{ name: 'Empréstimos e financiamentos', type: 'expense', icon: 'landmark', color: '#0f766e' }`. O `icons.ts` ganha `landmark: Landmark`.

- [ ] **Passo 1:** editar o schema e rodar `npm run db:migrate -w @fincontrol/api -- --name emprestimos`.
- [ ] **Passo 2:**
  1. Acrescentar o SQL acima ao `migration.sql`.
  2. Aplicar no banco de teste (`npx prisma migrate deploy`) e rodar `npm test -w @fincontrol/api`. Esperado: tudo PASS.
  3. Ajustar os testes que contam as categorias padrão (procure por `14` em `apps/api/test`) para 15.
- [ ] **Passo 3:** `git commit -m "feat(db): empréstimos, taxas do Banco Central e categoria de empréstimos"`

### Tarefa 5: sincronização das taxas, cron e busca de bancos

**Arquivos:**
- Criar: `apps/api/src/modules/bank-rates/bank-rates.{repository,service,routes}.ts`
- Modificar:
  - `apps/api/src/modules/demo/cron.routes.ts` (rota `sync-bank-rates`);
  - `apps/api/src/http/{app,container,routes,deps}.ts` (`fetchFn` em `AppDeps`, default `fetch`);
  - `apps/api/vercel.json`.
- Teste: `apps/api/test/bank-rates.test.ts`

**Interfaces:**
- Consome: `createBcbClient` e `MODALITY_BY_KIND` (Tarefa 2).
- Produz:
  - `bankRates.sync(): Promise<{ modality: string; status: 'updated' | 'kept'; rows: number }[]>`;
  - `bankRates.comparison(modality: string, cnpj8: string | null): Promise<LoanComparisonDTO | null>`, que a Tarefa 6 consome;
  - `bankRates.searchBanks(q: string): Promise<BankDTO[]>`.

- [ ] **Passo 1: testes que falham**
  - **sync com `fetchFn` falso:**
    - Use o fixture de veículos para a modalidade de veículos e `{"value":[]}` para as outras.
    - A modalidade de veículos fica com 39 linhas, período 2026-10-23 a 2026-10-29 e status `updated`.
    - As demais ficam `kept`, com 0 linhas.
  - **Período novo substitui o antigo:** semeie uma linha antiga de veículos (período 2026-10-16) e rode o sync. Só restam as linhas de 2026-10-23.
  - **Banco Central fora do ar (`fetchFn` rejeita) não apaga nada:** semeie 1 linha, rode o sync. Ele resolve com `kept` e loga um aviso, e a linha continua lá.
  - **`comparison`** com os dados de veículos semeados e `cnpj8 = '00000000'`:
    - `bank` = `{ name: 'BCO DO BRASIL S.A.', monthlyRate: 0.0112, annualRate: 0.1425, position: 7, of: 39 }`;
    - `market.monthlyRate` = 0.017 (mediana);
    - `periodStart` = '2026-10-23'.
    - Com um banco fora da lista, `bank` = `null` e `market` preenchido. Sem dados da modalidade, `null`.
  - **`GET /api/v1/banks?q=brasil`** (autenticado) traz `{ cnpj8: '00000000', name: 'BCO DO BRASIL S.A.' }`, sem repetir instituições. Sem token, dá 401.
  - **Cron:** `GET /api/v1/internal/cron/sync-bank-rates` sem segredo dá 401. Com `Authorization: Bearer <CRON_SECRET>`, dá 200 com o array do `sync`.
- [ ] **Passos 2 a 4:**
  - **sync:** para cada modalidade não nula de `MODALITY_BY_KIND`, chama `latestRates`.
    - Resultado `null` ou erro → `kept`, com `logger.warn`.
    - Resultado com dados → numa transação, `deleteMany({ modality })` + `createMany(rows)`.
    - Uma modalidade que falha não impede as outras.
  - **Mediana:** ordena as taxas mensais e tira a do meio, ou a média das duas do meio. Faz o mesmo para a anual.
  - **Conversão:** percentual ÷ 100 na saída.
  - **`searchBanks`:** `distinct` por `cnpj8`, com `institution contains q` (`mode: 'insensitive'`), em ordem de nome e com `take: 20`. `q` vazio devolve os 20 primeiros.
  - **`vercel.json`:** acrescentar `{ "path": "/api/v1/internal/cron/sync-bank-rates", "schedule": "0 7 * * 1" }` (D4).
  - Rodar até PASS.
- [ ] **Passo 5:** `git commit -m "feat(api): sincronização semanal das taxas do Banco Central e busca de bancos"`

### Tarefa 6: API de empréstimos

**Arquivos:**
- Criar: `apps/api/src/modules/loans/loans.{repository,service,routes}.ts`
- Modificar:
  - `apps/api/src/http/{container,routes}.ts`;
  - `apps/api/src/modules/transactions/transactions.mapper.ts` (`loanId`).
- Teste: `apps/api/test/loans.test.ts` (o "hoje" dos testes é 2026-11-11, de `test/helpers/app.ts`)

**Interfaces:**
- Consome: `loanSummary`/`loanWarnings` (Tarefa 1), os schemas da Tarefa 3 e `bankRates.comparison` (Tarefa 5).
- Produz: `GET|POST /loans`, `GET|PATCH|DELETE /loans/:id`, e `loansRepo.installmentsDueIn(userId, month): Promise<number>` para a Tarefa 7.

- [ ] **Passo 1: testes que falham**

```ts
async function loanScenario(over: Record<string, unknown> = {}) {
  const user = await newUser();
  const checking = await createAccount(app, user, { name: 'Corrente', initialBalance: 500000 });
  const res = await request(app).post('/api/v1/loans').set(user.auth).send({
    name: 'Carro', kind: 'vehicle', bankName: 'BCO DO BRASIL S.A.', bankCnpj8: '00000000',
    principal: 3000000, installmentAmount: 95000, installmentsTotal: 48, installmentsPaidBefore: 12,
    firstDueDate: '2025-12-10', accountId: checking.id, ...over,
  });
  return { user, checking, res };
}

it('"já paguei 12 de 48" gera só as 36 restantes como pendentes, na categoria de empréstimos (critério 5)', async () => {
  const { user, res } = await loanScenario();
  expect(res.status).toBe(201);
  const rows = await testDb.transaction.findMany({ where: { loanId: res.body.id }, orderBy: { dueDate: 'asc' } });
  expect(rows).toHaveLength(36);
  expect(rows.every((r) => r.status === 'pending' && r.type === 'expense' && r.amount === 95000n)).toBe(true);
  expect(rows[0]).toMatchObject({ installmentNumber: 13, installmentTotal: 48, description: 'Carro (13/48)' });
  expect(toDateOnly(rows[0]!.dueDate)).toBe('2026-12-10'); // 1ª parcela 2025-12-10 + 12 meses
  const cat = await testDb.category.findUnique({ where: { id: rows[0]!.categoryId! } });
  expect(cat!.name).toBe('Empréstimos e financiamentos');
  const detail = (await request(app).get(`/api/v1/loans/${res.body.id}`).set(user.auth)).body;
  expect(detail).toMatchObject({ installmentsPaid: 12, remainingCount: 36, outstanding: 2477608, payoffSavings: 942392, totalCost: 4560000, interest: 1560000 });
});

it('pagar uma parcela pelo fluxo normal atualiza o progresso', async () => {
  const { user, res } = await loanScenario();
  const first = await testDb.transaction.findFirst({ where: { loanId: res.body.id }, orderBy: { dueDate: 'asc' } });
  await request(app).post(`/api/v1/transactions/${first!.id}/pay`).set(user.auth).send({ paidDate: '2026-11-10' });
  const detail = (await request(app).get(`/api/v1/loans/${res.body.id}`).set(user.auth)).body;
  expect(detail).toMatchObject({ installmentsPaid: 13, remainingCount: 35 });
});

it('compara com o banco e com a mediana do mercado quando há taxas sincronizadas (critério 6)', async () => {
  await seedBankRatesFromFixture('bcb-veiculos-2026-10-23.json'); // helper novo em test/helpers/bank-rates.ts
  const { user, res } = await loanScenario();
  const detail = (await request(app).get(`/api/v1/loans/${res.body.id}`).set(user.auth)).body;
  expect(detail.comparison).toMatchObject({
    modality: 'Aquisição de veículos - Prefixado', periodStart: '2026-10-23', periodEnd: '2026-10-29', source: 'Banco Central do Brasil',
    bank: { name: 'BCO DO BRASIL S.A.', position: 7, of: 39 }, market: { monthlyRate: 0.017 },
  });
});

it('sem taxas sincronizadas, a comparação é null e o cálculo próprio continua', async () => {
  const { user, res } = await loanScenario();
  const detail = (await request(app).get(`/api/v1/loans/${res.body.id}`).set(user.auth)).body;
  expect(detail.comparison).toBeNull();
  expect(detail.monthlyRate).toBeCloseTo(0.0185795, 6);
});

it('taxa informada diferente avisa; já pagas ≥ total dá 422; já pagas = total − 1 gera 1 parcela', async () => {
  const a = await loanScenario({ informedMonthlyRate: 0.015 });
  expect((await request(app).get(`/api/v1/loans/${a.res.body.id}`).set(a.user.auth)).body.warnings).toEqual(['informed_rate_differs']);
  expect((await loanScenario({ installmentsPaidBefore: 48 })).res.status).toBe(422);
  const c = await loanScenario({ installmentsPaidBefore: 47 });
  expect(await testDb.transaction.count({ where: { loanId: c.res.body.id } })).toBe(1);
});

it('excluir apaga as pendentes e mantém as pagas sem o vínculo, sem mexer em outro empréstimo', async () => {
  const { user, checking, res } = await loanScenario();
  const other = await request(app).post('/api/v1/loans').set(user.auth).send({
    name: 'Outro', kind: 'personal', bankName: 'X', principal: 100000, installmentAmount: 10000, installmentsTotal: 12,
    firstDueDate: '2026-12-01', accountId: checking.id,
  });
  const first = await testDb.transaction.findFirst({ where: { loanId: res.body.id }, orderBy: { dueDate: 'asc' } });
  await request(app).post(`/api/v1/transactions/${first!.id}/pay`).set(user.auth).send({ paidDate: '2026-11-10' });
  expect((await request(app).delete(`/api/v1/loans/${res.body.id}`).set(user.auth)).status).toBe(204);
  expect(await testDb.transaction.count({ where: { loanId: res.body.id } })).toBe(0);
  expect(await testDb.transaction.findUnique({ where: { id: first!.id } })).toMatchObject({ status: 'paid', loanId: null });
  expect(await testDb.transaction.count({ where: { loanId: other.body.id } })).toBe(12);
});

it('isolamento: empréstimo de outro usuário dá 404 em GET, PATCH e DELETE; conta de outro usuário no POST dá 404', async () => {
  const { res } = await loanScenario();
  const intruder = await newUser();
  for (const call of [request(app).get(`/api/v1/loans/${res.body.id}`), request(app).patch(`/api/v1/loans/${res.body.id}`).send({ name: 'x' }), request(app).delete(`/api/v1/loans/${res.body.id}`)]) {
    expect((await call.set(intruder.auth)).status).toBe(404);
  }
  const theirs = await loanScenario();
  const mine = await newUser();
  const post = await request(app).post('/api/v1/loans').set(mine.auth).send({
    name: 'X', kind: 'personal', bankName: 'X', principal: 100000, installmentAmount: 10000, installmentsTotal: 12,
    firstDueDate: '2026-12-01', accountId: theirs.checking.id,
  });
  expect(post.status).toBe(404);
});
```

- [ ] **Passos 2 a 4:**
  - **POST:**
    - valida que a conta é do usuário, ativa e não é cartão (422 se for cartão ou estiver arquivada);
    - acha a categoria "Empréstimos e financiamentos" do usuário, ou cria se a pessoa a apagou;
    - numa única `$transaction`, grava o `Loan` e as parcelas k = antes+1 … N:
      - `type: 'expense'`, `nature: 'fixed'`, `status: 'pending'`;
      - `dueDate = dateInMonth(addMonthsToYm(monthOf(firstDueDate), k − 1), dia de firstDueDate)`;
      - `description: \`${name} (${k}/${N})\``;
      - `installmentNumber: k`, `installmentTotal: N` (a web já mostra o selo "k/N"), `loanId`.
  - **Leituras:**
    - `installmentsPaid` = `installmentsPaidBefore` + parcelas com `loanId` e `status: 'paid'`;
    - o resumo vem de `loanSummary` e os avisos de `loanWarnings`;
    - `comparison` usa `MODALITY_BY_KIND[kind]` + `bankRates.comparison(modality, bankCnpj8)`. `other` → `null`;
    - `nextDue` é a pendente mais antiga.
  - **`PATCH`:** só `name`. Não renomeia as parcelas já criadas (YAGNI).
  - **`DELETE`:** numa transação, `deleteMany({ loanId, status: 'pending' })` + `delete(loan)`. A FK `SET NULL` desvincula as pagas.
  - **`installmentsDueIn(userId, month)`:** soma de `amount` dos lançamentos com `loanId != null` e `dueDate` no mês, pagos ou pendentes.
  - Criar `test/helpers/bank-rates.ts` com `seedBankRatesFromFixture(file)`, que lê o fixture e grava em `bank_rates` como o sync grava.
  - Rodar até PASS.
- [ ] **Passo 5:** `git commit -m "feat(api): empréstimos com taxa real, parcelas no livro-caixa e comparação com o Banco Central"`

### Tarefa 7: painel — parcelas de empréstimo no comprometimento

**Arquivos:**
- Modificar: `apps/api/src/modules/dashboard/dashboard.service.ts` e `apps/api/src/http/container.ts`
- Teste: `apps/api/test/dashboard.test.ts`

**Interfaces:**
- Consome: `loansRepo.installmentsDueIn` (Tarefa 6).
- Produz: `health.debtPayments` = dívida do cartão (Parte A) + parcelas de empréstimo do mês corrente (C13).

- [ ] **Passo 1: teste que falha**
  - Use um usuário com receitas pagas de 500000 em agosto, setembro e outubro.
  - Ele tem um empréstimo de 12x de 50000 com 1ª parcela em 2026-11-20, ou seja, uma parcela em novembro.
  - Esperado: `health.debtPayments === 50000` e `health.debtCommitment === 0.1`.
  - Somando à compra 3x de 90000 do teste da Parte A: `debtPayments === 80000` e `debtCommitment === 0.16`.
- [ ] **Passos 2 a 4:** acrescentar `loansRepo.installmentsDueIn(userId, current)` ao **mesmo** `Promise.all` do `getSummary` (a revisão da Parte A pediu isso). Somar a `debt.debtPayments` e rodar até PASS.
- [ ] **Passo 5:** `git commit -m "feat(api): parcelas de empréstimo no comprometimento de renda"`

### Tarefa 8: demo com financiamento de veículo

**Arquivos:**
- Modificar:
  - `apps/api/src/domain/demo-data.ts`, `apps/api/src/modules/demo/demo.service.ts` e `apps/api/src/http/container.ts` (`inTransaction` ganha o repositório de empréstimos);
  - `apps/api/test/demo.test.ts` e `apps/api/src/domain/demo-data.test.ts`.

**O que muda (D5):**
- "Financiamento do carro", `kind: 'vehicle'`, banco `BCO DO BRASIL S.A.` / `00000000`;
- `principal: 3000000`, `installmentAmount: 95000`, `installmentsTotal: 48`, `installmentsPaidBefore: 6`;
- a 1ª parcela 6 meses antes do 1º mês do histórico da demo, no dia 10, paga pela Conta corrente. Assim as parcelas 7 a 12 caem dentro do histórico, como **pagas**, e as 13 a 48 ficam pendentes.

- [ ] **Passo 1:**
  - **Teste que falha:** depois do seed, `GET /loans` traz 1 empréstimo com `installmentsPaid === 12`, e o detalhe tem `remainingCount === 36`.
  - **`demo-data.test`:** continua determinístico.
  - Com `seedBankRatesFromFixture('bcb-veiculos-2026-10-23.json')`, o detalhe tem `comparison.bank.position === 7`.
- [ ] **Passos 2 a 4:**
  - gerar o plano no `buildDemoData`, com as transações pagas com `loanId` resolvido no seed;
  - gravar dentro do `inTransaction`, no mesmo seed atômico;
  - rodar PASS e o E2E (`npm run test:e2e`), porque a demo muda a tela do painel.
- [ ] **Passo 5:** `git commit -m "feat(demo): financiamento de veículo com 12 de 48 parcelas pagas"`

### Tarefa 9: web — lista, cadastro e menu

**Arquivos:**
- Criar: `apps/web/src/features/loans/{api.ts,loans-page.tsx,loan-form.tsx,bank-picker.tsx}`
- Modificar:
  - `apps/web/src/app/{router,nav}.tsx`;
  - `apps/web/src/features/dashboard/health-tiles.tsx` (texto do detalhe do comprometimento).
- Testes: `loans-page.test.tsx`, `loan-form.test.tsx` e o teste de `health-tiles`.

- [ ] **Passo 1: testes que falham**
  - **Lista:**
    - cada empréstimo mostra o nome, o banco e "12 de 48 pagas" (barra de progresso com `role="progressbar"` e `aria-valuenow`);
    - mostra também a taxa "1,86% ao mês" e o saldo devedor;
    - lista vazia mostra o `EmptyState` com "Cadastrar empréstimo".
  - **Formulário:**
    - **campos:** Nome, Tipo (as 7 opções de `LOAN_KIND_LABELS`), Banco, Valor recebido, Valor da parcela, Número de parcelas, Parcelas já pagas, Vencimento da 1ª parcela, Conta que paga e Taxa informada (opcional, em % ao mês);
    - **prévia:** com 10.000,00 / 600,00 / 24, mostra "Taxa real: 3,15% ao mês (45,07% ao ano)" e "Você recebeu R$ 10.000,00 e vai devolver R$ 14.400,00. R$ 4.400,00 são juros." (critério 4);
    - **POST:** envia a taxa informada como fração (2,5 → 0,025).
  - **Seletor de banco:** busca `GET /banks?q=` (com debounce) e, ao escolher, preenche `bankName` e `bankCnpj8`. Sem resultado, aceita o nome digitado, sem CNPJ.
  - **Menu:** o item "Empréstimos" (ícone `Landmark`) aponta para `/emprestimos`.
  - **Tile:** o detalhe passa a dizer "em parcelas de empréstimos e do cartão e faturas vencidas".
- [ ] **Passos 2 a 4:**
  - componentes existentes (`Field`, `Input`, `Select`, `MoneyInput`, `Dialog`, `Panel`, `EmptyState`);
  - prévia com `loanSummary` de `@fincontrol/shared` (D6);
  - mutações com `useFinanceMutation`, que invalida contas, lançamentos e painel;
  - rotas dentro do `RequireAuth`;
  - conferir a barra inferior com 6 itens a 360 px. Se não couber, reduzir o rótulo no celular, nunca esconder o item.
  - Rodar até PASS.
- [ ] **Passo 5:** `git commit -m "feat(web): empréstimos — lista, cadastro com taxa real na prévia e menu"`

### Tarefa 10: web — detalhe do empréstimo e comparação

**Arquivos:**
- Criar: `apps/web/src/features/loans/{loan-detail-page.tsx,rate-comparison.tsx}`
- Modificar: `apps/web/src/app/router.tsx` (`/emprestimos/:id`)
- Teste: `loan-detail-page.test.tsx`

- [ ] **Passo 1: testes que falham**
  - **Cabeçalho:** "Taxa real 1,86% ao mês · 24,72% ao ano".
  - **Frase de custo:** "Você pegou R$ 30.000,00 e vai devolver R$ 45.600,00; R$ 15.600,00 são juros."
  - **Números:** pago, falta e saldo devedor.
  - **Quitação estimada:** R$ 24.776,08, rotulada "Estimativa", com a economia de R$ 9.423,92 e a explicação curta (CDC art. 52 §2º: redução proporcional dos juros).
  - **Comparação:**
    - "BCO DO BRASIL S.A.: 1,12% ao mês (7º de 39)";
    - "Mediana do mercado: 1,70% ao mês";
    - "Fonte: Banco Central do Brasil · período de 23/10/2026 a 29/10/2026".
    - A sua taxa maior que a mediana mostra "Acima do mercado", com ícone e texto. Menor ou igual mostra "Dentro do mercado".
  - **Sem comparação:** "Ainda não há taxas do Banco Central para comparar este tipo de crédito."
  - **Avisos:**
    - `informed_rate_differs` → "A taxa informada difere da calculada. Pode haver seguro ou tarifa embutida."
    - `rate_too_high` → "Taxa acima de 30% ao mês. Confira os valores digitados."
    - `sac_approximate` → "Financiamentos imobiliários costumam usar SAC; esta taxa é aproximada."
  - **Ações:** "Renomear" (PATCH) e "Excluir empréstimo", com confirmação que diz que as parcelas pendentes serão apagadas e as pagas ficam no histórico.
- [ ] **Passos 2 a 4:** implementar e rodar até PASS. Conferir visualmente em 360 px e no desktop.
- [ ] **Passo 5:** `git commit -m "feat(web): detalhe do empréstimo com quitação estimada e comparação com o Banco Central"`

### Tarefa 11: E2E, documentação e entrega

**Arquivos:**
- Criar: `e2e/tests/emprestimo.spec.ts`
- Modificar:
  - `e2e/tests/mobile-e-publico.spec.ts` (inclui `/emprestimos` e o detalhe do empréstimo da demo);
  - `e2e/tests/screenshots.spec.ts` (`emprestimo.png`);
  - `README.md` e `docs/HANDOFF.md`.

- [ ] **Passo 1: E2E que falha**
  1. Cadastro → corrente de R$ 5.000.
  2. Cadastrar um empréstimo: R$ 10.000 em 24x de R$ 600, 1ª parcela no mês seguinte.
  3. Antes de salvar, a prévia mostra "3,15% ao mês". Depois de salvar, o detalhe mostra "R$ 4.400,00 são juros".
  4. Em Lançamentos, a primeira parcela aparece como pendente, com o selo "1/24".
  5. Excluir o empréstimo: a parcela some de Lançamentos.
- [ ] **Passo 2:** rodar `npm run test:e2e` até PASS e regenerar os screenshots (`SCREENSHOTS=1 npm run test:e2e -- screenshots`).
- [ ] **Passo 3:** atualizar o README e o HANDOFF.
  - **README:** funcionalidade de empréstimos, contagem de testes e roadmap (sub-projeto 2 completo).
  - **HANDOFF:**
    - o que foi entregue;
    - a migration a aplicar no Supabase **antes** do deploy da API;
    - rodar o sync uma vez, logo depois do deploy, para não esperar a segunda-feira: `vercel curl` na rota do cron com o `CRON_SECRET`, usando `MSYS_NO_PATHCONV=1`.
- [ ] **Passo 4:** gates completos (`lint`, `typecheck`, `npm test` e E2E).
- [ ] **Passo 5:** `git commit -m "test(e2e): cadastro de empréstimo com taxa real; docs da Parte B"`. Depois, push e PR (via @devops), aguardando o CI e o CodeRabbit.
