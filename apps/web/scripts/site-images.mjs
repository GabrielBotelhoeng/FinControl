/**
 * Converte as capturas reais da demo (geradas por `e2e/tests/site-capturas.spec.ts` com SITE_CAPTURES=1) para o site
 * de apresentação (sub-projeto 17, S9): WebP qualidade 80 em `public/site/` (até 780 px no celular e 1440 px no
 * computador, mais versões de 420 e 560 px de cada captura do celular para o `srcset`) e a imagem de compartilhamento
 * comprimida em `public/og-image.png`. Uso: `npm run site:images -w @fincontrol/web`.
 */
import { mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SRC = fileURLToPath(new URL('../../../e2e/.site-capturas/', import.meta.url));
const OUT = fileURLToPath(new URL('../public/site/', import.meta.url));
const OG = fileURLToPath(new URL('../public/og-image.png', import.meta.url));

// O tablet aparece pequeno, ao lado do notebook (sub-projeto 20): 560 px bastam.
const MAX_WIDTH = { celular: 780, tablet: 560, computador: 1440 };
// Versões menores do celular para o `srcset`: o aparelho do herói tem ~235 px de tela num celular (420 px com 1,75x) e
// as outras telas, ~320 px (560 px).
const PHONE_SMALLER = [420, 560];

async function main() {
  const files = (await readdir(SRC)).filter((f) => f.endsWith('.png') && f !== 'og-image.png');
  if (files.length === 0) throw new Error(`Nenhuma captura em ${SRC}. Rode antes: SITE_CAPTURES=1 npm run test:e2e -- site-capturas`);
  await mkdir(OUT, { recursive: true });
  for (const file of files) {
    const name = file.replace(/\.png$/, '');
    const width = name.endsWith('-computador') ? MAX_WIDTH.computador : name.endsWith('-tablet') ? MAX_WIDTH.tablet : MAX_WIDTH.celular;
    const info = await sharp(SRC + file)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(`${OUT}${name}.webp`);
    console.log(`site/${name}.webp  ${info.width}×${info.height}  ${Math.round(info.size / 1024)} KB`);
    if (!name.endsWith('-celular')) continue;
    for (const w of PHONE_SMALLER) {
      // A de 420 px é a do LCP do herói no celular: qualidade 70 (mostrada a ~235 px, a diferença não aparece).
      const quality = w === 420 ? 70 : 80;
      const small = await sharp(SRC + file).resize({ width: w }).webp({ quality }).toFile(`${OUT}${name}-${w}.webp`);
      console.log(`site/${name}-${w}.webp  ${small.width}×${small.height}  ${Math.round(small.size / 1024)} KB`);
    }
  }
  // Rodando só uma parte das capturas (ex.: `-g tablet`), a og-image não é refeita: fica a que já está no repositório.
  if (!(await readdir(SRC)).includes('og-image.png')) {
    console.log('og-image.png não foi refeita nesta execução; mantida a atual.');
    return;
  }
  const og = await sharp(SRC + 'og-image.png').resize(1200, 630).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(OG);
  console.log(`og-image.png  ${og.width}×${og.height}  ${Math.round(og.size / 1024)} KB`);
}

main().catch((error) => {
  console.error('Falha ao gerar as imagens do site:', error.message);
  process.exit(1);
});
