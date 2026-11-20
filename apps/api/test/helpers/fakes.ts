import type { AuthAdmin } from '../../src/infra/auth-admin';

export function fakeAuthAdmin(): AuthAdmin & { deleted: string[]; failNext: boolean } {
  const deleted: string[] = [];
  const fake = {
    deleted,
    /** A próxima exclusão no Auth falha (uma vez), como uma queda do Supabase. */
    failNext: false,
    async deleteUser(userId: string) {
      if (fake.failNext) {
        fake.failNext = false;
        throw new Error('Supabase Auth indisponível');
      }
      deleted.push(userId);
    },
  };
  return fake;
}
