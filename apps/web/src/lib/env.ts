import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL: z.url(),
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
});

export type WebEnv = z.infer<typeof envSchema>;

export function readEnv(source: Record<string, unknown> = import.meta.env): WebEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => i.path.join('.')))].join(', ');
    throw new Error(`Configuração ausente no front: ${fields}. Veja apps/web/.env.example.`);
  }
  return parsed.data;
}
