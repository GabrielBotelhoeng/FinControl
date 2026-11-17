import { z } from 'zod';
import type { NotificationPrefs } from '../notifications';
import { NON_EMPTY_MESSAGE, nonEmpty } from './common';
import { notificationPrefsSchema } from './notifications';

export const themeSchema = z.enum(['light', 'dark', 'system']);
export type ThemePreference = z.infer<typeof themeSchema>;

export const updateProfileSchema = z
  .object({ name: z.string().trim().min(1, 'Obrigatório').max(80, 'Máximo de 80 caracteres'), theme: themeSchema, notificationPrefs: notificationPrefsSchema })
  .partial()
  .refine(nonEmpty, NON_EMPTY_MESSAGE);

export type UpdateProfileInput = z.output<typeof updateProfileSchema>;

export type ProfileDTO = { id: string; name: string; email: string | null; isDemo: boolean; theme: ThemePreference; notificationPrefs: NotificationPrefs };
