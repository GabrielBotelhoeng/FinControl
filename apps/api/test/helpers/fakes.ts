import type { AuthAdmin } from '../../src/infra/auth-admin';

export function fakeAuthAdmin(): AuthAdmin & { deleted: string[] } {
  const deleted: string[] = [];
  return {
    deleted,
    async deleteUser(userId: string) {
      deleted.push(userId);
    },
  };
}
