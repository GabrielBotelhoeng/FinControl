/**
 * Roda uma vez, antes dos workers. Marca o início da execução numa variável de ambiente, que os workers herdam: o
 * teste das capturas do site só monta a og-image com capturas feitas a partir daqui (site-capturas.spec.ts).
 */
export default function globalSetup() {
  process.env.E2E_RUN_STARTED = String(Date.now());
}
