import { z } from 'zod';
import { MAX_CENTS } from '../money';
import { MAX_STATEMENT_ROWS } from '../statement';
import { dateOnlySchema, idSchema } from './common';

const rowSchema = z.object({
  date: dateOnlySchema,
  description: z.string().trim().min(1, 'Obrigatório').max(120, 'Máximo de 120 caracteres'),
  /** Com sinal: negativo = saída (despesa), positivo = entrada (receita). */
  amount: z.number().int().min(-MAX_CENTS).max(MAX_CENTS).refine((v) => v !== 0, 'Valor zero'),
});

/** I4: as linhas lidas no navegador; a API devolve a categoria sugerida e se parece repetido. */
export const importPreviewSchema = z.object({ accountId: idSchema, rows: z.array(rowSchema).min(1).max(MAX_STATEMENT_ROWS) });

/** I6: o que a pessoa confirmou, com a categoria escolhida em cada linha. */
export const importCommitSchema = z.object({
  accountId: idSchema,
  rows: z.array(rowSchema.extend({ categoryId: idSchema })).min(1).max(MAX_STATEMENT_ROWS),
});

export type ImportPreviewInput = z.output<typeof importPreviewSchema>;
export type ImportCommitInput = z.output<typeof importCommitSchema>;

export type ImportPreviewRowDTO = {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  /** I5: categoria do último lançamento com a mesma descrição, ou a de uma palavra-chave, ou "Outros". */
  categoryId: string | null;
  suggestion: 'history' | 'keyword' | 'fallback';
  /** I7: já existe na conta um lançamento no mesmo dia, com o mesmo valor e o mesmo tipo. */
  duplicate: boolean;
};

export type ImportPreviewDTO = { rows: ImportPreviewRowDTO[] };
export type ImportCommitDTO = { created: number };
