import { rmSync } from 'node:fs';

/**
 * Roda uma vez, antes dos workers. Marca o início da execução numa variável de ambiente, que os workers herdam: o
 * teste das capturas do site só monta a og-image com capturas feitas a partir daqui (site-capturas.spec.ts). Numa
 * rodada de capturas (SITE_CAPTURES=1), a pasta começa vazia: o `site:images` só converte o que foi feito nesta rodada,
 * e uma rodada parcial (ex.: `-g tablet`) não leva uma og-image velha para o site (CodeRabbit, PR #42).
 */
export default function globalSetup() {
  process.env.E2E_RUN_STARTED = String(Date.now());
  if (process.env.SITE_CAPTURES) rmSync('.site-capturas', { recursive: true, force: true });
}
