import { describe, expect, it } from 'vitest';
import { pgConfig } from './prisma';

const URL_WITH_SSL = 'postgresql://u:p@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require&uselibpqcompat=true&pgbouncer=true';
const CA = '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----';

describe('pgConfig', () => {
  it('sem CA, usa a URL como veio (desenvolvimento e testes)', () => {
    expect(pgConfig(URL_WITH_SSL)).toEqual({ connectionString: URL_WITH_SSL });
  });

  it('com CA, valida o certificado e tira da URL os parâmetros de SSL que sobrescreveriam essa validação', () => {
    const cfg = pgConfig(URL_WITH_SSL, CA);
    expect(cfg.ssl).toEqual({ ca: CA, rejectUnauthorized: true });
    const url = new URL(cfg.connectionString);
    expect(url.searchParams.has('sslmode')).toBe(false);
    expect(url.searchParams.has('uselibpqcompat')).toBe(false);
    expect(url.searchParams.get('pgbouncer')).toBe('true');
    expect(url.hostname).toBe('aws-0-sa-east-1.pooler.supabase.com');
  });
});
