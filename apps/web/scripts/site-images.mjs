/**
 * Converte as capturas reais da demo (geradas por `e2e/tests/site-capturas.spec.ts` com SITE_CAPTURES=1) para o site
 * de apresentação (sub-projeto 17, S9): WebP qualidade 80 em `public/site/` (até 780 px no celular e 1440 px no
 * computador) e a imagem de compartilhamento comprimida em `public/og-image.png`. Uso: `npm run site:images -w @fincontrol/web`.
 */
import { mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SRC = fileURLToPath(new URL('../../../e2e/.site-capturas/', import.meta.url));
const OUT = fileURLToPath(new URL('../public/site/', import.meta.url));
const OG = fileURLToPath(new URL('../public/og-image.png', import.meta.url));

const MAX_WIDTH = { celular: 780, computador: 1440 };

async function main() {
  const files = (await readdir(SRC)).filter((f) => f.endsWith('.png') && f !== 'og-image.png');
  if (files.length === 0) throw new Error(`Nenhuma captura em ${SRC}. Rode antes: SITE_CAPTURES=1 npm run test:e2e -- site-capturas`);
  await mkdir(OUT, { recursive: true });
  for (const file of files) {
    const name = file.replace(/\.png$/, '');
    const width = name.endsWith('-computador') ? MAX_WIDTH.computador : MAX_WIDTH.celular;
    const info = await sharp(SRC + file)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(`${OUT}${name}.webp`);
    console.log(`site/${name}.webp  ${info.width}×${info.height}  ${Math.round(info.size / 1024)} KB`);
  }
  const og = await sharp(SRC + 'og-image.png').resize(1200, 630).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(OG);
  console.log(`og-image.png  ${og.width}×${og.height}  ${Math.round(og.size / 1024)} KB`);
}

main().catch((error) => {
  console.error('Falha ao gerar as imagens do site:', error.message);
  process.exit(1);
});
