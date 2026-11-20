import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env';
import { AiError, type AiBlock, type AiRequest, type AiResponse, type AiToolResultBlock } from '../src/infra/ai-client';
import { MAX_TOOL_ROUNDS } from '../src/modules/assistant/assistant.service';
import { buildTestApp } from './helpers/app';
import { newUser, type TestUser } from './helpers/auth';
import { resetDb, testDb } from './helpers/db';
import { categoryId, createAccount, createSubcategory, createTransaction } from './helpers/factories';

type Step = AiResponse | Error;

/** Cliente falso: devolve as respostas na ordem e guarda cada pedido. */
function fakeAi() {
  const calls: AiRequest[] = [];
  const script: Step[] = [];
  const client = async (req: AiRequest): Promise<AiResponse> => {
    // Cópia: o serviço continua mexendo no mesmo array de mensagens.
    calls.push({ ...req, messages: [...req.messages] });
    const next = script.shift() ?? text('ok');
    if (next instanceof Error) throw next;
    return next;
  };
  return { calls, script, client };
}

const usage = { input_tokens: 100, output_tokens: 20 };
const text = (t: string): AiResponse => ({ content: [{ type: 'text', text: t }], stop_reason: 'end_turn', usage });
const toolUse = (...uses: { name: string; input?: Record<string, unknown> }[]): AiResponse => ({
  content: uses.map((u, i) => ({ type: 'tool_use', id: `t${i}`, name: u.name, input: u.input ?? {} })),
  stop_reason: 'tool_use',
  usage,
});
const toolResults = (req: AiRequest) => (req.messages.at(-1)!.content as AiBlock[]).filter((b): b is AiToolResultBlock => b.type === 'tool_result');

const ai = fakeAi();
const { app } = buildTestApp({ aiClient: ai.client });
const ask = (user: TestUser, content = 'Quanto gastei?') => request(app).post('/api/v1/assistant/chat').set(user.auth).send({ messages: [{ role: 'user', content }] });
const consent = (user: TestUser) => request(app).post('/api/v1/assistant/consent').set(user.auth);

describe('Assistente com IA', () => {
  beforeEach(async () => {
    await resetDb();
    ai.calls.length = 0;
    ai.script.length = 0;
  });

  it('A3–A5: config diz se está ligado, se a conta pode usar e se aceitou', async () => {
    const user = await newUser();
    const config = () => request(app).get('/api/v1/assistant/config').set(user.auth);
    expect((await config()).body).toEqual({ enabled: true, allowed: true, consented: false });
    expect((await consent(user)).status).toBe(204);
    expect((await config()).body).toEqual({ enabled: true, allowed: true, consented: true });
    expect((await request(app).delete('/api/v1/assistant/consent').set(user.auth)).status).toBe(204);
    expect((await config()).body.consented).toBe(false);

    const demo = await newUser({ isAnonymous: true });
    expect((await request(app).get('/api/v1/assistant/config').set(demo.auth)).body).toEqual({ enabled: true, allowed: false, consented: false });
    expect((await consent(demo)).status).toBe(403);
    expect((await ask(demo)).status).toBe(403);
  });

  it('A3: sem chave, desligado (503)', async () => {
    const { ANTHROPIC_API_KEY: _k, ...rest } = loadConfig();
    const off = buildTestApp({ config: rest as ReturnType<typeof loadConfig> }).app;
    const user = await newUser();
    expect((await request(off).get('/api/v1/assistant/config').set(user.auth)).body.enabled).toBe(false);
    expect((await request(off).post('/api/v1/assistant/consent').set(user.auth)).status).toBe(503);
  });

  it('A4: sem lista de e-mails, ninguém usa', async () => {
    const closed = buildTestApp({ aiClient: ai.client, config: { ...loadConfig(), AI_ALLOWED_EMAILS: [] } }).app;
    const user = await newUser();
    expect((await request(closed).get('/api/v1/assistant/config').set(user.auth)).body.allowed).toBe(false);
  });

  it('A3: conta que saiu da demo (perfil demo, token não anônimo) continua bloqueada', async () => {
    const user = await newUser();
    await request(app).get('/api/v1/assistant/config').set(user.auth);
    await testDb.profile.update({ where: { id: user.id }, data: { isDemo: true } });
    expect((await request(app).get('/api/v1/assistant/config').set(user.auth)).body.allowed).toBe(false);
  });

  it('A4: com a lista de e-mails, só quem está nela usa', async () => {
    const listed = buildTestApp({ aiClient: ai.client, config: { ...loadConfig(), AI_ALLOWED_EMAILS: ['ana@x.com'] } }).app;
    const ana = await newUser({ email: 'Ana@X.com' });
    const bia = await newUser({ email: 'bia@x.com' });
    expect((await request(listed).get('/api/v1/assistant/config').set(ana.auth)).body.allowed).toBe(true);
    expect((await request(listed).get('/api/v1/assistant/config').set(bia.auth)).body.allowed).toBe(false);
    expect((await request(listed).post('/api/v1/assistant/consent').set(bia.auth)).status).toBe(403);
  });

  it('A5: sem consentimento, 409 e nada vai para a Anthropic; histórico inválido dá 400', async () => {
    const user = await newUser();
    expect((await ask(user)).status).toBe(409);
    expect(ai.calls).toHaveLength(0);
    await consent(user);
    const bad = await request(app).post('/api/v1/assistant/chat').set(user.auth).send({ messages: [{ role: 'assistant', content: 'oi' }] });
    expect(bad.status).toBe(400);
  });

  it('responde direto, com o prompt curto levando hoje, o nome e as categorias', async () => {
    const user = await newUser({ name: 'Gabriel Botelho' });
    await consent(user);
    ai.script.push(text('Você está bem!'));
    const res = await ask(user);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reply: 'Você está bem!' });
    const [call] = ai.calls;
    expect(call!.system).toContain('2026-11-11 (quarta-feira)');
    expect(call!.system).toContain('Gabriel');
    expect(call!.system).not.toContain('Botelho');
    expect(call!.system).toMatch(/Categorias de despesa: .*Alimentação/);
    expect(call!.max_tokens).toBe(700);
    expect(call!.tools.map((t) => t.name)).toEqual(['resumo_periodo', 'buscar_lancamentos', 'orcamento_mes', 'metas', 'saldos_e_dividas']);
  });

  it('A7: busca lançamentos pela descrição e devolve o resultado para o modelo, em reais', async () => {
    const user = await newUser();
    await consent(user);
    const account = await createAccount(app, user, { initialBalance: 100000 });
    const food = await categoryId(app, user, 'Alimentação', 'expense');
    const expense = (description: string, amount: number, dueDate: string) =>
      createTransaction(app, user, { type: 'expense', amount, description, accountId: account.id, nature: 'variable', categoryId: food, dueDate });
    await expense('Cerveja no bar', 4590, '2026-11-05');
    await expense('Cerveja mercado', 2000, '2026-10-20');
    await expense('Pão', 800, '2026-11-06');

    ai.script.push(toolUse({ name: 'buscar_lancamentos', input: { texto: 'cerveja', categoria: 'alimentacao' } }), text('Você gastou R$ 65,90 com cerveja.'));
    const res = await ask(user, 'Quanto gastei com cerveja?');
    expect(res.body.reply).toBe('Você gastou R$ 65,90 com cerveja.');
    expect(ai.calls).toHaveLength(2);
    const [result] = toolResults(ai.calls[1]!);
    const data = JSON.parse(result!.content);
    expect(data).toMatchObject({ periodo: { de: '2026-09-01', ate: '2026-11-30' }, quantidade: 2, total_despesas: 65.9, total_receitas: 0 });
    expect(data.lancamentos[0]).toEqual({ data: '2026-11-05', descricao: 'Cerveja no bar', valor: 45.9, tipo: 'despesa', categoria: 'Alimentação', situacao: 'pendente' });
    expect(result!.content).not.toContain(account.id);
  });

  it('A7: as cinco ferramentas respondem com os dados da pessoa; pedido inválido volta como erro para o modelo', async () => {
    const user = await newUser();
    await consent(user);
    await createAccount(app, user, { name: 'Nubank', initialBalance: 150000 });
    ai.script.push(
      toolUse(
        { name: 'resumo_periodo', input: { de: '2026-10', ate: '2027-03' } },
        { name: 'orcamento_mes' },
        { name: 'metas' },
        { name: 'saldos_e_dividas' },
        { name: 'buscar_lancamentos', input: { categoria: 'Inexistente' } },
        { name: 'apagar_tudo' },
      ),
      text('Pronto.'),
    );
    expect((await ask(user)).status).toBe(200);
    const results = toolResults(ai.calls[1]!);
    const [resumo, orcamento, metas, saldos, busca, desconhecida] = results;
    expect(JSON.parse(resumo!.content)).toMatchObject({ periodo: { de: '2026-10', ate: '2026-11' }, receitas: 0, despesas: 0 });
    expect(JSON.parse(orcamento!.content)).toMatchObject({ mes: '2026-11', categorias: [] });
    expect(JSON.parse(metas!.content)).toEqual([]);
    expect(JSON.parse(saldos!.content)).toMatchObject({ contas: [{ conta: 'Nubank', tipo: 'conta corrente', saldo: 1500 }], saldo_total: 1500 });
    expect(busca).toMatchObject({ is_error: true });
    expect(busca!.content).toContain('Alimentação');
    expect(desconhecida).toMatchObject({ is_error: true, content: 'Ferramenta desconhecida: apagar_tudo' });
  });

  it('T9 (sub-projeto 13): buscar_lancamentos filtra por tag e mostra as tags; o prompt lista as tags da pessoa', async () => {
    const user = await newUser();
    await consent(user);
    const account = await createAccount(app, user, { initialBalance: 100000 });
    const food = await categoryId(app, user, 'Alimentação', 'expense');
    const expense = (description: string, tags: string[]) =>
      createTransaction(app, user, { type: 'expense', amount: 3000, description, accountId: account.id, nature: 'variable', categoryId: food, dueDate: '2026-11-05', tags });
    await expense('Cerveja no mercado', ['bebida']);
    await expense('Pão', []);
    ai.script.push(toolUse({ name: 'buscar_lancamentos', input: { tag: '#Bebida' } }), text('Pronto.'));
    expect((await ask(user)).status).toBe(200);
    expect(ai.calls[0]!.system).toContain('Tags da pessoa: bebida.');
    const data = JSON.parse(toolResults(ai.calls[1]!)[0]!.content);
    expect(data).toMatchObject({ quantidade: 1, total_despesas: 30 });
    expect(data.lancamentos[0]).toMatchObject({ descricao: 'Cerveja no mercado', tags: ['bebida'] });
  });

  it('U10 (sub-projeto 15): o prompt lista as subcategorias; buscar pela categoria inclui as subcategorias e mostra o caminho', async () => {
    const user = await newUser();
    await consent(user);
    const account = await createAccount(app, user, { initialBalance: 100000 });
    const food = await categoryId(app, user, 'Alimentação', 'expense');
    const restaurant = await createSubcategory(app, user, food, 'Restaurante');
    await createSubcategory(app, user, food, 'Mercado');
    const expense = (description: string, category: string) =>
      createTransaction(app, user, { type: 'expense', amount: 3000, description, accountId: account.id, nature: 'variable', categoryId: category, dueDate: '2026-11-05' });
    await expense('Pizza', restaurant);
    await expense('Feira', food);
    ai.script.push(toolUse({ name: 'buscar_lancamentos', input: { categoria: 'alimentação' } }), toolUse({ name: 'buscar_lancamentos', input: { categoria: 'Restaurante' } }), text('Pronto.'));
    expect((await ask(user)).status).toBe(200);
    expect(ai.calls[0]!.system).toContain('Alimentação (Mercado, Restaurante)');
    const all = JSON.parse(toolResults(ai.calls[1]!)[0]!.content);
    expect(all.quantidade).toBe(2);
    expect(all.lancamentos).toEqual(expect.arrayContaining([expect.objectContaining({ descricao: 'Pizza', categoria: 'Alimentação › Restaurante' })]));
    expect(JSON.parse(toolResults(ai.calls[2]!)[0]!.content)).toMatchObject({ quantidade: 1, lancamentos: [{ descricao: 'Pizza' }] });
  });

  it('B12 (sub-projeto 11): saldos_e_dividas traz o patrimônio líquido e só os bens com valor', async () => {
    const user = await newUser();
    await consent(user);
    await createAccount(app, user, { name: 'Nubank', initialBalance: 150000 });
    const asset = (body: Record<string, unknown>) => request(app).post('/api/v1/assets').set(user.auth).send(body);
    await asset({ name: 'Carro', kind: 'vehicle', value: 4000000 });
    const sold = (await asset({ name: 'Moto', kind: 'vehicle', value: 900000 })).body;
    await request(app).post(`/api/v1/assets/${sold.id}/valuations`).set(user.auth).send({ amount: 0, date: '2026-11-11' });
    ai.script.push(toolUse({ name: 'saldos_e_dividas' }), text('Pronto.'));
    expect((await ask(user)).status).toBe(200);
    const saldos = JSON.parse(toolResults(ai.calls[1]!)[0]!.content);
    expect(saldos).toMatchObject({ patrimonio_liquido: 41500, bens: [{ bem: 'Carro', tipo: 'Veículo', valor: 40000 }] });
    expect(saldos.bens).toHaveLength(1);
  });

  it('A8: depois de 4 rodadas de ferramenta, a última chamada proíbe ferramentas', async () => {
    const user = await newUser();
    await consent(user);
    for (let i = 0; i < 10; i += 1) ai.script.push(toolUse({ name: 'metas' }));
    const res = await ask(user);
    expect(res.status).toBe(200);
    expect(ai.calls).toHaveLength(MAX_TOOL_ROUNDS + 1);
    expect(ai.calls.at(-1)!.tool_choice).toEqual({ type: 'none' });
    expect(ai.calls[0]!.tool_choice).toBeUndefined();
    expect(res.body.reply).toMatch(/Não consegui/);
  });

  it('isolamento: as ferramentas de uma pessoa nunca veem os lançamentos de outra', async () => {
    const ana = await newUser();
    const bia = await newUser();
    await consent(ana);
    const account = await createAccount(app, bia, { name: 'Conta da Bia' });
    const food = await categoryId(app, bia, 'Alimentação', 'expense');
    await createTransaction(app, bia, { type: 'expense', amount: 9900, description: 'Cerveja da Bia', accountId: account.id, nature: 'variable', categoryId: food, dueDate: '2026-11-05' });
    ai.script.push(
      toolUse({ name: 'buscar_lancamentos', input: { texto: 'cerveja' } }, { name: 'saldos_e_dividas' }, { name: 'resumo_periodo', input: { de: '2026-11', ate: '2026-11' } }),
      text('Nada.'),
    );
    await ask(ana);
    const all = toolResults(ai.calls[1]!).map((r) => r.content).join(' ');
    expect(all).not.toContain('Bia');
    expect(JSON.parse(toolResults(ai.calls[1]!)[0]!.content)).toMatchObject({ quantidade: 0 });
  });

  it('erros de regra das ferramentas voltam para o modelo; categoria homônima pede o tipo; só a data final olha os 3 meses antes', async () => {
    const user = await newUser();
    await consent(user);
    ai.script.push(
      toolUse(
        { name: 'orcamento_mes', input: { mes: '2028-01' } },
        { name: 'buscar_lancamentos', input: { categoria: 'Outros' } },
        { name: 'buscar_lancamentos', input: { categoria: 'Outros', tipo: 'receita' } },
        { name: 'buscar_lancamentos', input: { ate: '2026-01-31' } },
      ),
      text('Pronto.'),
    );
    expect((await ask(user)).status).toBe(200);
    const [budget, homonym, income, onlyEnd] = toolResults(ai.calls[1]!);
    expect(budget).toMatchObject({ is_error: true });
    expect(homonym).toMatchObject({ is_error: true });
    expect(homonym!.content).toMatch(/Informe o tipo/);
    expect(income!.is_error).toBeUndefined();
    expect(JSON.parse(onlyEnd!.content).periodo).toEqual({ de: '2025-11-01', ate: '2026-01-31' });
  });

  it('A9: o uso do dia fica no banco; passou de 100 perguntas, 429; passou do teto geral, 503', async () => {
    const user = await newUser();
    await consent(user);
    ai.script.push(text('a'));
    await ask(user);
    expect(await testDb.aiUsage.findMany({ select: { requests: true, inputTokens: true, outputTokens: true } })).toEqual([{ requests: 1, inputTokens: 100, outputTokens: 20 }]);

    await testDb.aiUsage.updateMany({ data: { requests: 100 } });
    const limited = await ask(user);
    expect(limited.status).toBe(429);
    expect(limited.body.detail).toMatch(/100 perguntas hoje/);

    const other = await newUser();
    await consent(other);
    await testDb.aiUsage.updateMany({ data: { requests: 400 } });
    expect((await ask(other)).status).toBe(503);
    expect(ai.calls).toHaveLength(1);
  });

  it('A9: perguntas ao mesmo tempo não passam do limite do dia (auditoria final)', async () => {
    const user = await newUser();
    await consent(user);
    await ask(user);
    await testDb.aiUsage.updateMany({ data: { requests: 99 } });
    const before = ai.calls.length;
    const results = await Promise.all(Array.from({ length: 5 }, () => ask(user)));
    expect(results.map((r) => r.status).sort()).toEqual([200, 429, 429, 429, 429]);
    expect(ai.calls.length - before).toBe(1);
    expect((await testDb.aiUsage.findFirst())!.requests).toBe(100);
  });

  it('A11: créditos esgotados e sobrecarga viram 503 com mensagem clara', async () => {
    const user = await newUser();
    await consent(user);
    ai.script.push(new AiError('credit', 'Your credit balance is too low'));
    const credit = await ask(user);
    expect(credit.status).toBe(503);
    expect(credit.body.detail).toMatch(/créditos do assistente acabaram/);
    ai.script.push(new AiError('busy', 'Overloaded'));
    expect((await ask(user)).body.detail).toMatch(/ocupado/);
    ai.script.push(new AiError('config', 'invalid x-api-key'));
    const config = await ask(user);
    expect(config.status).toBe(503);
    expect(config.body.detail).toMatch(/configuração/);
    // Pergunta que falhou também conta no limite do dia.
    expect((await testDb.aiUsage.findFirst())!.requests).toBe(3);
  });

  it('A8: a última rodada termina com os resultados das ferramentas e ainda declara as ferramentas', async () => {
    const user = await newUser();
    await consent(user);
    for (let i = 0; i < MAX_TOOL_ROUNDS; i += 1) ai.script.push(toolUse({ name: 'metas' }));
    ai.script.push(text('fim'));
    await ask(user);
    const last = ai.calls.at(-1)!;
    expect(last.tools).toHaveLength(5);
    expect(last.messages.at(-1)!.role).toBe('user');
    expect(toolResults(last)).toHaveLength(1);
  });

  it('A5: o consentimento grava a hora do aceite', async () => {
    const user = await newUser();
    await consent(user);
    expect((await testDb.profile.findUnique({ where: { id: user.id } }))!.aiConsentAt).toEqual(new Date('2026-11-11T15:00:00Z'));
  });
});
