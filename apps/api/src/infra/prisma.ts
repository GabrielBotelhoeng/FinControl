import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../generated/prisma/client';

export type Db = PrismaClient;

/** O cliente normal ou o de uma transação interativa. Repositórios que não abrem transações próprias aceitam os dois. */
export type DbClient = Prisma.TransactionClient;

// No `pg`, parâmetros SSL da URL sobrescrevem o objeto `ssl`; com CA, eles precisam sair da URL.
const SSL_URL_PARAMS = ['sslmode', 'uselibpqcompat', 'sslrootcert', 'sslcert', 'sslkey', 'ssl'];

/**
 * Com o certificado da CA do Supabase, a conexão valida a cadeia e o nome do host (verify-full).
 * Sem ele (desenvolvimento e testes), a URL vale como veio.
 */
export function pgConfig(databaseUrl: string, caCert?: string): { connectionString: string; ssl?: { ca: string; rejectUnauthorized: true } } {
  if (!caCert) return { connectionString: databaseUrl };
  const url = new URL(databaseUrl);
  for (const param of SSL_URL_PARAMS) url.searchParams.delete(param);
  return { connectionString: url.toString(), ssl: { ca: caCert, rejectUnauthorized: true } };
}

export function createPrisma(databaseUrl: string, caCert?: string): Db {
  return new PrismaClient({ adapter: new PrismaPg(pgConfig(databaseUrl, caCert)) });
}
