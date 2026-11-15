import { describe, expect, it } from 'vitest';
import { router } from './router';

describe('router', () => {
  it('serve /privacidade sem exigir login (rota de topo, fora do RequireAuth)', () => {
    expect(router.routes.map((r) => r.path)).toContain('/privacidade');
  });

  it('serve /termos sem exigir login', () => {
    expect(router.routes.map((r) => r.path)).toContain('/termos');
  });

  it('serve /cartoes/:id dentro do RequireAuth (Tarefa 11)', () => {
    const protectedRoute = router.routes.find((r) => r.path === '/');
    expect(protectedRoute?.children?.map((c) => c.path)).toContain('cartoes/:id');
  });
});
