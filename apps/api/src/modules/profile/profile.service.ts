import { notificationPrefs, type ProfileDTO, type ThemePreference, type UpdateProfileInput } from '@fincontrol/shared';
import { NotFoundError } from '../../http/errors';
import type { AuthAdmin } from '../../infra/auth-admin';
import type { AuthClaims } from '../../infra/token-verifier';
import type { ProfileRepository } from './profile.repository';
import type { Provisioner } from './provisioning';

type ProfileRecord = { id: string; name: string; isDemo: boolean; theme: ThemePreference; notificationPrefs: unknown };

const toDTO = (p: ProfileRecord, email: string | null): ProfileDTO => ({
  id: p.id, name: p.name, email, isDemo: p.isDemo, theme: p.theme, notificationPrefs: notificationPrefs(p.notificationPrefs),
});

export function createProfileService(deps: { repo: ProfileRepository; provisioner: Provisioner; authAdmin: AuthAdmin }) {
  return {
    async get(claims: AuthClaims): Promise<ProfileDTO> {
      const profile = await deps.repo.find(claims.userId);
      if (!profile) throw new NotFoundError('Perfil');
      return toDTO(profile, claims.email);
    },
    async update(claims: AuthClaims, input: UpdateProfileInput): Promise<ProfileDTO> {
      return toDTO(await deps.repo.update(claims.userId, input), claims.email);
    },
    /**
     * LGPD: apaga os dados (cascata a partir do perfil) e depois o usuário no Supabase Auth. `remember` guarda o id
     * para um token antigo não recriar o perfil; a limpeza da demo não precisa (os tokens dela já expiraram).
     */
    async deleteAccount(userId: string, { remember = true }: { remember?: boolean } = {}): Promise<void> {
      await deps.repo.delete(userId, remember);
      deps.provisioner.forget(userId);
      try {
        await deps.authAdmin.deleteUser(userId);
      } catch (err) {
        // A pessoa continua no Auth: sem desfazer a marca, ela ficaria com 401 para sempre (revisão final).
        if (remember) await deps.repo.forgetDeleted(userId);
        throw err;
      }
    },
  };
}

export type ProfileService = ReturnType<typeof createProfileService>;
