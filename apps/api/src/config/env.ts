import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url(),
  // PEM da CA do Supabase (prod-ca-2021.crt). Com ela, a conexão com o banco valida certificado e host.
  DATABASE_CA_CERT: z.string().includes('-----BEGIN CERTIFICATE-----').optional(),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  WEB_ORIGIN: z.url(),
  // Regex (ancorada pelo app) das URLs de preview da web, ex.: deploys de PR na Vercel.
  WEB_PREVIEW_ORIGIN_PATTERN: z
    .string()
    .refine(isValidRegex, 'Regex inválida')
    .optional(),
  CRON_SECRET: z.string().min(32),
});

function isValidRegex(source: string): boolean {
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
}

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => i.path.join('.')))].join(', ');
    throw new Error(`Variáveis de ambiente inválidas ou ausentes: ${fields}`);
  }
  return parsed.data;
}
