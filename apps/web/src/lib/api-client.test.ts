import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './api-client';

function jsonResponse(status: number, body: unknown, type = 'application/json') {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': type } });
}

function setup(response: Response | Error) {
  const fetchFn = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  const onUnauthorized = vi.fn();
  const api = createApiClient({ baseUrl: 'http://api.test/api/v1', getToken: async () => 'tok', onUnauthorized, fetchFn });
  return { api, fetchFn, onUnauthorized };
}

describe('createApiClient', () => {
  it('anexa o Bearer token e serializa a query sem undefined', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, [{ id: 1 }]));
    const data = await api.get('/accounts', { includeArchived: true, q: undefined });
    expect(data).toEqual([{ id: 1 }]);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api.test/api/v1/accounts?includeArchived=true');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok');
  });

  it('envia JSON no corpo', async () => {
    const { api, fetchFn } = setup(jsonResponse(201, { id: 'a' }));
    await api.post('/accounts', { name: 'X' });
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"name":"X"}');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });

  it('converte problem+json em ApiError com fieldErrors', async () => {
    const { api } = setup(
      jsonResponse(400, { title: 'Dados inválidos', status: 400, detail: 'Um ou mais campos são inválidos.', errors: [{ path: 'name', message: 'Obrigatório' }] }, 'application/problem+json'),
    );
    const err = await api.post('/accounts', {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, title: 'Dados inválidos', message: 'Um ou mais campos são inválidos.' });
    expect((err as ApiError).fieldErrors[0]).toEqual({ path: 'name', message: 'Obrigatório' });
  });

  it('chama onUnauthorized no 401 e lança ApiError', async () => {
    const { api, onUnauthorized } = setup(jsonResponse(401, { title: 'Não autenticado', status: 401, detail: 'Faça login.' }, 'application/problem+json'));
    await expect(api.get('/me')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('erro de rede vira ApiError status 0 com mensagem amigável', async () => {
    const { api } = setup(new TypeError('Failed to fetch'));
    await expect(api.get('/me')).rejects.toMatchObject({ status: 0, message: 'Não foi possível conectar ao servidor. Verifique sua internet.' });
  });

  it('204 resolve undefined', async () => {
    const { api } = setup(new Response(null, { status: 204 }));
    await expect(api.del('/accounts/1')).resolves.toBeUndefined();
  });
});
