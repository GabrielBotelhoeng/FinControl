import { createClient } from '@supabase/supabase-js';

export interface AuthAdmin {
  deleteUser(userId: string): Promise<void>;
}

export function createSupabaseAuthAdmin(supabaseUrl: string, serviceRoleKey: string): AuthAdmin {
  const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async deleteUser(userId) {
      const { error } = await client.auth.admin.deleteUser(userId);
      if (error && error.status !== 404) throw new Error(`Falha ao excluir usuário no Auth: ${error.message}`);
    },
  };
}
