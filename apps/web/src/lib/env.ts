import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL: z.url(),
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
});

export type WebEnv = z.infer<typeof envSchema>;

export type EnvCheck = { ok: true; env: WebEnv } | { ok: false; fields: string[] };

/** Valida a configuração do build sem lançar erro: quem chama decide o que mostrar (veja main.tsx). */
export function checkEnv(source: Record<string, unknown> = import.meta.env): EnvCheck {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return { ok: true, env: parsed.data };
  return { ok: false, fields: [...new Set(parsed.error.issues.map((i) => i.path.join('.')))] };
}
