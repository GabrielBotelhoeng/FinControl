import { fileURLToPath } from 'node:url';

process.loadEnvFile(fileURLToPath(new URL('../.env.test', import.meta.url)));
