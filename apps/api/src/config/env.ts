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
  // Web Push (sub-projeto 5, Parte B, W1): as três juntas, ou nenhuma (push desligado).
  // base64url: a pública tem 65 bytes (87 caracteres) e a privada 32 (43). Chave trocada falharia todo envio em silêncio.
  VAPID_PUBLIC_KEY: z.string().regex(/^[A-Za-z0-9_-]{87}$/, 'Chave pública VAPID inválida').optional(),
  VAPID_PRIVATE_KEY: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Chave privada VAPID inválida').optional(),
  VAPID_SUBJECT: z.string().regex(/^(mailto:|https:\/\/)/, 'Use mailto: ou https://').optional(),
}).refine(
  (e) => [e.VAPID_PUBLIC_KEY, e.VAPID_PRIVATE_KEY, e.VAPID_SUBJECT].every((v) => v === undefined) || [e.VAPID_PUBLIC_KEY, e.VAPID_PRIVATE_KEY, e.VAPID_SUBJECT].every((v) => v !== undefined),
  { message: 'Informe VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT juntas', path: ['VAPID_PUBLIC_KEY'] },
);

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
