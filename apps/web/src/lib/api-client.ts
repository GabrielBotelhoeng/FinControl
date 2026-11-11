export type FieldError = { path: string; message: string };

export class ApiError extends Error {
  readonly status: number;
  readonly title: string;
  readonly fieldErrors: FieldError[];

  constructor(status: number, title: string, message: string, fieldErrors: FieldError[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.title = title;
    this.fieldErrors = fieldErrors;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export type ApiClient = {
  get<T>(path: string, query?: Query): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
  del(path: string): Promise<void>;
};

type Options = {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  onUnauthorized: () => void;
  fetchFn?: typeof fetch;
};

const NETWORK_MESSAGE = 'Não foi possível conectar ao servidor. Verifique sua internet.';

function buildUrl(baseUrl: string, path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return `${baseUrl}${path}${qs ? `?${qs}` : ''}`;
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { title?: string; detail?: string; errors?: FieldError[] };
    return new ApiError(res.status, body.title ?? 'Erro', body.detail ?? body.title ?? 'Algo deu errado.', body.errors ?? []);
  } catch {
    return new ApiError(res.status, 'Erro', 'Algo deu errado. Tente novamente.');
  }
}

export function createApiClient({ baseUrl, getToken, onUnauthorized, fetchFn = fetch }: Options): ApiClient {
  async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
    const headers = new Headers({ Accept: 'application/json' });
    const token = await getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (body !== undefined) headers.set('Content-Type', 'application/json');

    let res: Response;
    try {
      res = await fetchFn(buildUrl(baseUrl, path, query), {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new ApiError(0, 'Sem conexão', NETWORK_MESSAGE);
    }

    if (res.status === 401) onUnauthorized();
    if (!res.ok) throw await toApiError(res);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return {
    get: (path, query) => request('GET', path, undefined, query),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    del: (path) => request<void>('DELETE', path),
  };
}
