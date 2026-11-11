import { idSchema, isValidDateOnly } from '@fincontrol/shared';
import { ValidationError } from '../../http/errors';
import type { Cursor, TransactionRow } from './transactions.repository';

export function encodeCursor(row: Pick<TransactionRow, 'dueDate' | 'id'>): string {
  return Buffer.from(`${row.dueDate}|${row.id}`, 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): Cursor {
  const [dueDate, id] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
  if (!dueDate || !id || !isValidDateOnly(dueDate) || !idSchema.safeParse(id).success) {
    throw new ValidationError([{ path: 'cursor', message: 'Cursor inválido' }]);
  }
  return { dueDate, id };
}
