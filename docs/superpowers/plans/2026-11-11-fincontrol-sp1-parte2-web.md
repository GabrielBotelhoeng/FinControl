# FinControl SP1 — Parte 2: Web (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o frontend do sub-projeto 1, com todas as telas da spec (seção 8) funcionando contra a API da Parte 1, em layout mobile-first, tema claro e escuro, PWA instalável e testes de componentes.

**Architecture:** O frontend vive em `apps/web` e usa React 19, Vite 8 e TypeScript. Os dados do servidor passam pelo TanStack Query, e os hooks ficam separados por feature em `features/*/api.ts`. A API é acessada por um cliente HTTP injetável (`ApiClient`, via context) que anexa o JWT e converte `problem+json` em `ApiError`. A autenticação passa pela interface `AuthGateway`, cuja implementação real é o Supabase; os testes usam um fake. Os formulários usam `react-hook-form` com os schemas Zod de `@fincontrol/shared`. A UI é um kit próprio no estilo shadcn: Tailwind v4 com tokens CSS e Radix só para o Dialog.

**Tech Stack:** React 19, Vite 8, Tailwind CSS 4 (`@tailwindcss/vite`), React Router 8 (modo library), TanStack Query 5, @supabase/supabase-js 2, react-hook-form 7 + @hookform/resolvers 5, Recharts 3, lucide-react, sonner, @radix-ui/react-dialog, vite-plugin-pwa 2, fontes Outfit + Manrope (via @fontsource-variable), Vitest 5 + jsdom + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-11-fincontrol-fundacao-fluxo-caixa-design.md` (seções 3.2, 7, 8 e 9)

**Nota de execução (ruling do planejador):** quem planeja e quem executa são o mesmo agente, na mesma sessão. Este plano define os arquivos, as interfaces, os testes completos e o código das peças críticas (tokens, cliente HTTP, auth, máscara de dinheiro). O código das telas é escrito na execução, guiado pelos testes e pelo comportamento descrito aqui, para não duplicar milhares de linhas entre plano e commit.

## Global Constraints

- Textos em pt-BR com acentuação correta. Moeda via `formatBRL`; datas no formato `dd/mm/aaaa` (helper `formatDate`).
- Valores sempre em **centavos** entre front e API. A máscara converte na borda do input.
- Verde (`income`) só para receita e vermelho (`expense`) só para despesa; nunca como decoração.
- Contraste WCAG AA nos dois temas, foco visível em todo elemento interativo, números com `tabular-nums`.
- Mobile-first: nada pode exigir rolagem horizontal em 360 px. Navegação inferior abaixo de `md`, barra lateral a partir de `md`.
- Toda tela tem estado de carregamento (skeleton), de lista vazia (com chamada para a primeira ação) e de erro (com "Tentar de novo").
- Variáveis de ambiente: `VITE_API_URL`, `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, validadas com Zod em `lib/env.ts`.
- Lint, typecheck e testes verdes na raiz ao fim de cada task. Cada task vira um commit; a parte inteira vira um PR mergeado na `main`.

## Direção visual

A direção visual está em **`DESIGN.md`** (mundo "Aurora no cofre", com o corahub.com.br como referência de linguagem, pedida pelo usuário). Ele é a fonte de verdade de tokens, tipografia (Outfit + Manrope), forma e movimento, e substitui a tabela que este plano tinha antes. O escuro é o padrão.

**Ruling (ajuste de escopo):** a tela `/entrar` vira uma página de entrada no estilo landing, com o título grande em contraste de peso, as pílulas de CTA ("Experimentar sem cadastro" em destaque), a arte gerada no Higgsfield e o cartão de login ao lado. É o primeiro contato de recrutadores e clientes, e o usuário pediu acabamento de portfólio. Skills usadas no design: impeccable (craft-floor), frontend-design e design-taste-frontend.

## Review Focus

1. **Token expirado no meio do uso:** um 401 da API deve fazer logout e mandar para `/entrar`, sem loop de requisições. Teste: Task 2.
2. **Valor digitado com vírgula, ponto ou colado com "R$":** a máscara deve produzir os centavos corretos ou mostrar erro no campo, nunca enviar `NaN`. Teste: Task 4.
3. **Clique duplo em "Experimentar sem cadastro":** o botão fica desabilitado durante a chamada (registrado na revisão da Parte 1). Teste: Task 3.
4. **Editar ou excluir lançamento recorrente:** sempre pergunta o escopo ("Só esta" ou "Esta e as próximas") antes de chamar a API. Teste: Task 7.
5. **API fora do ar:** a tela mostra o estado de erro com "Tentar de novo", não fica em branco nem em skeleton infinito. Teste: Task 8.

---

### Task 1: Scaffold do `apps/web`, tokens, tema e utilitários de formatação

**Files:**
- Create: `apps/web/package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/styles/index.css`, `src/vite-env.d.ts`, `src/test/setup.ts`
- Create: `src/lib/format.ts`, `src/lib/cn.ts`, `src/app/theme.tsx`
- Modify: `eslint.config.js` (globals de browser para `apps/web`)
- Test: `src/lib/format.test.ts`, `src/app/theme.test.tsx`

**Interfaces (Produces):**
- `formatDate(d: DateOnly): string` → `"11/11/2026"`; `formatMonthLabel(ym): string` → `"novembro de 2026"`; `formatSignedBRL(cents, type): string` (receita com `+`, despesa com `−`, transferência sem sinal)
- `cn(...classes): string`
- `ThemeProvider` e `useTheme(): { theme: 'light'|'dark'|'system'; setTheme(t) }`. Aplica `data-theme` no `<html>`, resolve `system` por `matchMedia` e persiste em `localStorage` (com try/catch).

Testes:
```ts
// format.test.ts
expect(formatDate('2026-11-11')).toBe('11/11/2026');
expect(formatMonthLabel('2026-11')).toBe('novembro de 2026');
expect(formatSignedBRL(1050, 'income').replace(/ /g, ' ')).toBe('+R$ 10,50');
expect(formatSignedBRL(1050, 'expense').replace(/ /g, ' ')).toBe('−R$ 10,50');
expect(formatSignedBRL(1050, 'transfer').replace(/ /g, ' ')).toBe('R$ 10,50');
// theme.test.tsx: setTheme('dark') → document.documentElement.dataset.theme === 'dark';
// 'system' com matchMedia(prefers dark) → 'dark'; o valor persiste em localStorage['fincontrol-theme'].
```

- [ ] Instalar as dependências, criar a configuração e os tokens, e escrever os testes (que falham).
- [ ] Implementar `format.ts`, `cn.ts` e `theme.tsx` até ficar verde, com lint e typecheck na raiz.
- [ ] Commit: `feat(web): scaffold Vite + Tailwind v4 com tokens, tema claro/escuro e formatadores pt-BR`

### Task 2: Ambiente, cliente HTTP e React Query

**Files:** `src/lib/env.ts`, `src/lib/api-client.ts`, `src/lib/api-context.tsx`, `src/lib/query-client.ts`
**Test:** `src/lib/api-client.test.ts`

**Interfaces:**
- `class ApiError extends Error { status: number; title: string; fieldErrors: { path: string; message: string }[] }`
- `createApiClient(opts: { baseUrl: string; getToken: () => Promise<string | null>; onUnauthorized: () => void; fetchFn?: typeof fetch }): ApiClient`, com `ApiClient = { get<T>(path, query?), post<T>(path, body?), patch<T>(path, body), del(path) }`
- `ApiProvider` e `useApi(): ApiClient`
- `createQueryClient()`: `retry` não repete erro 4xx e tenta uma vez nos demais; `staleTime` de 30 s.

Testes (com `fetchFn` falso):
```ts
it('anexa o Bearer token e serializa a query sem undefined')        // GET /accounts?includeArchived=true
it('converte problem+json em ApiError com fieldErrors')             // 400 → err.status 400, fieldErrors[0].path 'name'
it('chama onUnauthorized uma vez no 401 e lança ApiError')
it('erro de rede vira ApiError status 0 com mensagem amigável')     // "Não foi possível conectar ao servidor."
it('204 resolve undefined')
```
- [ ] RED → GREEN → commit `feat(web): cliente HTTP com JWT, problem+json e React Query`

### Task 3: Autenticação (gateway, provider, rotas protegidas e tela de entrada)

**Files:** `src/features/auth/gateway.ts` (interface e implementação Supabase), `auth-context.tsx`, `require-auth.tsx`, `login-page.tsx`, `src/test/fakes.ts`
**Test:** `src/features/auth/login-page.test.tsx`, `require-auth.test.tsx`

**Interfaces:**
```ts
export type AuthUser = { id: string; email: string | null; isAnonymous: boolean };
export interface AuthGateway {
  getSession(): Promise<{ user: AuthUser; accessToken: string } | null>;
  onChange(cb: (s: { user: AuthUser; accessToken: string } | null) => void): () => void;
  signInWithPassword(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, name: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signInAnonymously(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
}
// useAuth(): { status: 'loading'|'signed-in'|'signed-out'; user; isDemo; getToken; startDemo(); signOut(); gateway }
```
- `startDemo()` faz `signInAnonymously()` e depois `POST /demo/seed`.
- A tela de entrada tem as abas "Entrar" e "Criar conta", e-mail e senha (mínimo de 8 caracteres), "Continuar com Google", "Esqueci a senha" e o botão em destaque **"Experimentar sem cadastro"**, que fica desabilitado enquanto `pending`.
- Os erros do Supabase aparecem traduzidos: "Invalid login credentials" vira "E-mail ou senha incorretos.".

Testes:
```ts
it('mostra erro traduzido quando o login falha')
it('"Experimentar sem cadastro" chama signInAnonymously + /demo/seed uma vez e desabilita o botão durante a chamada')
it('valida e-mail e senha antes de chamar o gateway')
it('RequireAuth redireciona para /entrar quando signed-out e renderiza filhos quando signed-in')
```
- [ ] RED → GREEN → commit `feat(web): autenticação via gateway Supabase, rotas protegidas e entrada com demo`

### Task 4: Kit de UI e campo de dinheiro

**Files:** `src/components/ui/{button,card,input,field,select,dialog,skeleton,badge,states,money-input,segmented}.tsx`
**Test:** `src/components/ui/money-input.test.tsx`, `states.test.tsx`

- `MoneyInput` é controlado em centavos (`value: number | null`, `onChange(cents | null)`), exibe `1.234,56` e aceita digitação, colagem com "R$" e apagar.
- `ErrorState({ message, onRetry })`, `EmptyState({ title, description, action })` e `ListSkeleton({ rows })`.
- `Dialog` (Radix) vira tela cheia abaixo de `sm` (spec 8.3).

Testes:
```ts
it('digitar 1234 vira R$ 12,34 e emite 1234')               // máscara estilo caixa: dígitos entram pela direita
it('colar "R$ 1.234,56" emite 123456')
it('apagar tudo emite null')
it('ErrorState chama onRetry ao clicar em "Tentar de novo"')
```
- [ ] RED → GREEN → commit `feat(web): kit de UI acessível e campo de dinheiro em centavos`

### Task 5: Shell do app (layout, navegação, selo demo) e roteamento

**Files:** `src/app/router.tsx`, `src/app/app-shell.tsx`, `src/app/nav.tsx`, `src/app/providers.tsx`, `src/main.tsx`
**Test:** `src/app/app-shell.test.tsx`

- As rotas são `/entrar`, `/` (dashboard), `/lancamentos`, `/contas`, `/categorias` e `/perfil`. Tudo fora de `/entrar` fica sob `RequireAuth`.
- O shell tem a barra lateral (md+) e a navegação inferior (mobile), cada uma com 5 itens e `aria-current` no item ativo. Para usuário demo, um selo "Modo demo" fixo com o botão "Criar conta de verdade" (`signOut` + `/entrar?modo=cadastro`).

Testes:
```ts
it('marca o item ativo com aria-current="page"')
it('mostra o selo "Modo demo" só para usuário anônimo')
```
- [ ] RED → GREEN → commit `feat(web): shell responsivo com navegação, selo demo e rotas protegidas`

### Task 6: Contas e categorias

**Files:** `src/features/accounts/{api.ts,accounts-page.tsx,account-form.tsx,transfer-form.tsx}` e `src/features/categories/{api.ts,categories-page.tsx,category-form.tsx,delete-category-dialog.tsx}`, além de `src/features/categories/icons.ts` (mapa de nomes Lucide para componentes)
**Test:** `accounts-page.test.tsx`, `categories-page.test.tsx`

- **Contas:**
  - Cards com nome, tipo, saldo (`formatBRL`) e uma faixa com a cor da conta.
  - Ações: criar, editar, arquivar ou desarquivar, e transferir. A transferência cria `POST /transactions` do tipo `transfer` com status pago.
  - Um interruptor "Mostrar arquivadas".
- **Categorias:**
  - Abas Despesas e Receitas, com criar e editar (seletor de ícone e cor).
  - Excluir uma categoria em uso (resposta 409) abre o diálogo de reatribuição, que lista as categorias do mesmo tipo e chama o DELETE com `reassignTo`.

Testes (`ApiClient` falso):
```ts
it('lista contas com saldo formatado e estado vazio com ação "Criar conta"')
it('cria conta pelo formulário e envia centavos')
it('excluir categoria em uso abre o diálogo de reatribuição e envia reassignTo')
```
- [ ] RED → GREEN → commit `feat(web): telas de contas e categorias`

### Task 7: Lançamentos

**Files:** `src/features/transactions/{api.ts,transactions-page.tsx,transaction-form.tsx,filters.tsx,scope-dialog.tsx,group-by-day.ts}`
**Test:** `group-by-day.test.ts`, `transactions-page.test.tsx`

- A lista vem agrupada por dia, do mais recente para o mais antigo, com o cabeçalho "Hoje", "Ontem" ou a data.
- Cada item mostra o ícone da categoria, a descrição, a conta, o valor com sinal e cor, o selo "Vencido" e o indicador de recorrente. Um botão de check marca como pago ou desfaz.
- Filtros: mês (padrão o mês atual), tipo, status, conta, categoria e busca (debounce de 300 ms). A paginação usa "Carregar mais" (`nextCursor`, com `useInfiniteQuery`).
- O formulário tem o seletor de tipo (Despesa, Receita, Transferência), valor, descrição, conta, destino (só em transferência), categoria filtrada pelo tipo, natureza, vencimento, "Já está pago" e "Repetir" (frequência e fim opcional).
- Editar ou excluir um item com `recurrenceId` abre o `ScopeDialog` antes de chamar a API.

Testes:
```ts
it('groupByDay agrupa e rotula Hoje/Ontem com base em today')
it('editar lançamento recorrente pergunta o escopo e envia ?scope=future quando escolhido')
it('marcar como pago chama /pay e atualiza o item')
```
- [ ] RED → GREEN → commit `feat(web): lançamentos com filtros, paginação, formulário e escopo de recorrência`

### Task 8: Dashboard

**Files:** `src/features/dashboard/{api.ts,dashboard-page.tsx,summary-cards.tsx,upcoming-list.tsx,evolution-chart.tsx,category-donut.tsx,month-picker.tsx}`
**Test:** `dashboard-page.test.tsx`

- Os cards mostram saldo total, previsão de fim de mês, receitas e despesas do mês. A variação aparece com seta, e quando o mês anterior é zero mostra "—".
- A lista "A pagar" traz as pendentes e vencidas com o botão de pagar.
- Gráficos:
  - **Evolução de 6 meses:** barras de receita e despesa (cores `income`/`expense`) e uma linha de saldo (`primary`).
  - **Rosca de gastos por categoria:** usa a cor da própria categoria e tem legenda com os valores.
- O seletor de mês avança e recua.

Testes:
```ts
it('mostra os valores do resumo formatados e "—" quando changePercent é null')
it('API fora do ar mostra ErrorState e "Tentar de novo" refaz a busca')
```
- [ ] RED → GREEN → commit `feat(web): dashboard com resumo, a pagar, evolução e gastos por categoria`

### Task 9: Perfil

**Files:** `src/features/profile/{api.ts,profile-page.tsx,delete-account-dialog.tsx}`
**Test:** `profile-page.test.tsx`

- O perfil tem o nome (editável), o seletor de tema (Claro, Escuro, Sistema), que salva no `PATCH /me` e aplica via `useTheme`, e o botão "Sair".
- "Excluir minha conta" só fica habilitado depois de digitar `EXCLUIR`. Ao confirmar, chama `DELETE /me`, faz `signOut` e vai para `/entrar`.

Testes:
```ts
it('excluir conta exige digitar EXCLUIR')
it('trocar tema aplica data-theme e chama PATCH /me')
```
- [ ] RED → GREEN → commit `feat(web): perfil com tema, sair e exclusão de conta`

### Task 10: PWA, ícone, imagem da tela de entrada, verificação final e PR

**Files:** `vite.config.ts` (VitePWA), `public/icon.svg`, `public/pwa-192.png`, `public/pwa-512.png`, `public/maskable-512.png`, `src/assets/login-art.webp`, `README.md`, `.github/workflows/ci.yml` (build do web)

- Manifest: `name: "FinControl"`, `short_name: "FinControl"`, `lang: "pt-BR"`, `theme_color` primário, `display: "standalone"` e `start_url: "/"`. O service worker faz cache só do shell (`globPatterns` de js/css/html/fontes); a API não é cacheada.
- A ilustração da tela de entrada é gerada no Higgsfield, autorizado pelo usuário: abstrata, sem texto e sem marca, em tons do primário.
- Verificação: `npm run build -w @fincontrol/web` sem erros, lint, typecheck e todos os testes. Depois, smoke com `vite preview` em 360 px para conferir que não há rolagem horizontal.
- Abrir o PR `feat/sp1-web` e fazer o merge na `main` (aprovado pelo usuário).
- [ ] Commit `feat(web): PWA instalável, ícones e arte da tela de entrada`, push, PR e merge.
