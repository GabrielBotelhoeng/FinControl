import { z } from 'zod';
import { compareTags, MAX_TAG_LENGTH, MAX_TAGS, normalizeTag } from '../tags';

/** T2: letras (acentos valem), números, espaço, hífen e sublinhado. */
const TAG_CHARS = /^[\p{L}\p{N} _-]+$/u;

export const tagSchema = z
  .string('Informe a tag')
  .transform(normalizeTag)
  .pipe(
    z
      .string()
      .min(1, 'Tag vazia')
      .max(MAX_TAG_LENGTH, `A tag pode ter no máximo ${MAX_TAG_LENGTH} caracteres`)
      .regex(TAG_CHARS, 'Use só letras, números, espaço, hífen ou sublinhado'),
  );

/** T1 e T2: até 10, sem repetidas, em ordem alfabética. */
export const tagsSchema = z
  .array(tagSchema)
  .max(MAX_TAGS, `No máximo ${MAX_TAGS} tags por lançamento`)
  .transform((tags) => [...new Set(tags)].sort(compareTags));

/** T6: renomear (ou juntar com outra tag que já existe). */
export const renameTagSchema = z.object({ name: tagSchema });

export type TagDTO = { name: string; count: number };
