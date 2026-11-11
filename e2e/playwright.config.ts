import { defineConfig, devices } from '@playwright/test';

/**
 * Sobe a pilha inteira: provedor de identidade falso (fake-auth.ts), API real com migrations aplicadas
 * no Postgres de teste e a web buildada como em produção (vite build + preview).
 */
const AUTH_URL = 'http://localhost:54399';
const API_PORT = 3334;
const WEB_URL = 'http://localhost:4174';
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgresql://fincontrol:fincontrol@localhost:5435/fincontrol_test';

const apiEnv = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'warn',
  PORT: String(API_PORT),
  DATABASE_URL,
  DIRECT_URL: DATABASE_URL,
  SUPABASE_URL: AUTH_URL,
  SUPABASE_SERVICE_ROLE_KEY: 'e2e-service-role-key',
  WEB_ORIGIN: WEB_URL,
  CRON_SECRET: 'e2e-cron-secret-with-at-least-32-chars',
};

const webEnv = {
  VITE_API_URL: `http://localhost:${API_PORT}/api/v1`,
  VITE_SUPABASE_URL: AUTH_URL,
  VITE_SUPABASE_ANON_KEY: 'e2e-anon-key',
};

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: WEB_URL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    // O service worker do PWA cachearia a build entre testes; o E2E quer sempre a rede.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npx tsx fake-auth.ts',
      url: `${AUTH_URL}/auth/v1/health`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run db:deploy -w @fincontrol/api && npx tsx ../apps/api/src/server.ts',
      cwd: '.',
      url: `http://localhost:${API_PORT}/api/v1/health`,
      env: apiEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run build -w @fincontrol/web && npm run preview -w @fincontrol/web -- --port 4174 --strictPort',
      url: WEB_URL,
      env: webEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
