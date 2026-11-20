import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL: z.url(),
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
});

export type WebEnv = z.infer<typeof envSchema>;

export type EnvCheck = { ok: true; env: WebEnv } | { ok: false; fields: string[] };

/** Valida a configuração do build sem lançar erro: quem chama decide o que mostrar (veja main.tsx). */
// Só as três variáveis, uma a uma: passar `import.meta.env` inteiro fazia o Vite embutir no bundle todas as `VITE_*`,
// inclusive as de sistema da Vercel (commit, autor, ids do projeto) — auditoria final.
const buildEnv = {
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
};

export function checkEnv(source: Record<string, unknown> = buildEnv): EnvCheck {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return { ok: true, env: parsed.data };
  return { ok: false, fields: [...new Set(parsed.error.issues.map((i) => i.path.join('.')))] };
}
