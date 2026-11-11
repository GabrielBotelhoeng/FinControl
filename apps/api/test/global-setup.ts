import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export default function setup() {
  const apiRoot = fileURLToPath(new URL('..', import.meta.url));
  process.loadEnvFile(fileURLToPath(new URL('../.env.test', import.meta.url)));
  execSync('npx prisma migrate deploy', { cwd: apiRoot, env: process.env, stdio: 'inherit' });
}
