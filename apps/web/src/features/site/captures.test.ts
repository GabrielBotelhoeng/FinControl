import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAPTURES } from './captures';

// O Vitest roda a partir de apps/web.
const publicDir = resolve(process.cwd(), 'public');

describe('capturas do site', () => {
  it('toda captura aponta para um WebP que existe em public/site e tem descrição', () => {
    for (const capture of Object.values(CAPTURES)) {
      expect(capture.src).toMatch(/^\/site\/.+\.webp$/);
      expect(existsSync(publicDir + capture.src)).toBe(true);
      expect(capture.alt.length).toBeGreaterThan(20);
    }
  });

  it('a imagem de compartilhamento existe', () => {
    expect(existsSync(publicDir + '/og-image.png')).toBe(true);
  });
});
