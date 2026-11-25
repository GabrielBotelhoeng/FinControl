export type WebEnv = { VITE_API_URL: string; VITE_SUPABASE_URL: string; VITE_SUPABASE_ANON_KEY: string };

export type EnvCheck = { ok: true; env: WebEnv } | { ok: false; fields: string[] };

// Só as três variáveis, uma a uma: passar `import.meta.env` inteiro fazia o Vite embutir no bundle todas as `VITE_*`,
// inclusive as de sistema da Vercel (commit, autor, ids do projeto) — auditoria final.
const buildEnv = {
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
};

const isHttpUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const isFilled = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

// Sem o zod: esta validação roda no pedaço de entrada, que o site também carrega (sub-projeto 18, E10).
const RULES: Record<keyof WebEnv, (value: unknown) => value is string> = {
  VITE_API_URL: isHttpUrl,
  VITE_SUPABASE_URL: isHttpUrl,
  VITE_SUPABASE_ANON_KEY: isFilled,
};

/** Valida a configuração do build sem lançar erro: quem chama decide o que mostrar (veja main.tsx). */
export function checkEnv(source: Record<string, unknown> = buildEnv): EnvCheck {
  const keys = Object.keys(RULES) as (keyof WebEnv)[];
  // Os endereços sem os espaços das pontas, como o zod devolvia (um espaço no fim montaria um host inválido no login);
  // a chave anônima fica como veio.
  const values: Record<string, unknown> = Object.fromEntries(
    keys.map((key) => {
      const value = source[key];
      return [key, RULES[key] === isHttpUrl && typeof value === 'string' ? value.trim() : value];
    }),
  );
  const fields = keys.filter((key) => !RULES[key](values[key]));
  if (fields.length > 0) return { ok: false, fields };
  return { ok: true, env: Object.fromEntries(keys.map((key) => [key, values[key]])) as WebEnv };
}
