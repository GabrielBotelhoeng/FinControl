import { describe, expect, it } from 'vitest';
import { router } from './router';

describe('router', () => {
  it('serve /privacidade sem exigir login (rota de topo, fora do RequireAuth)', () => {
    expect(router.routes.map((r) => r.path)).toContain('/privacidade');
  });

  it('serve /termos sem exigir login', () => {
    expect(router.routes.map((r) => r.path)).toContain('/termos');
  });
});
