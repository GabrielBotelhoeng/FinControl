import { z } from 'zod';
import { isValidDateOnly } from '../dates';
import { MAX_CENTS } from '../money';

export const idSchema = z.uuid('Identificador inválido');
export const dateOnlySchema = z.string().refine(isValidDateOnly, 'Data inválida (use AAAA-MM-DD)');
export const yearMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês inválido (use AAAA-MM)');
export const centsSchema = z
  .number('Informe um número')
  .int('Valor deve ser em centavos (inteiro)')
  .positive('Valor deve ser maior que zero')
  .max(MAX_CENTS, 'Valor acima do limite');
export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida (use #RRGGBB)');
export const nameSchema = z.string().trim().min(1, 'Obrigatório').max(60, 'Máximo de 60 caracteres');

export const nonEmpty = (o: object) => Object.keys(o).length > 0;
export const NON_EMPTY_MESSAGE = 'Nada para atualizar';
