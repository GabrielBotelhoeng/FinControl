import type { ProfileDTO, ThemePreference, UpdateProfileInput } from '@fincontrol/shared';
import { NotFoundError } from '../../http/errors';
import type { AuthAdmin } from '../../infra/auth-admin';
import type { AuthClaims } from '../../infra/token-verifier';
import type { ProfileRepository } from './profile.repository';
import type { Provisioner } from './provisioning';

type ProfileRecord = { id: string; name: string; isDemo: boolean; theme: ThemePreference };

const toDTO = (p: ProfileRecord, email: string | null): ProfileDTO => ({
  id: p.id, name: p.name, email, isDemo: p.isDemo, theme: p.theme,
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
    /** LGPD: apaga os dados (cascata a partir do perfil) e depois o usuário no Supabase Auth. */
    async deleteAccount(userId: string): Promise<void> {
      await deps.repo.delete(userId);
      deps.provisioner.forget(userId);
      await deps.authAdmin.deleteUser(userId);
    },
  };
}

export type ProfileService = ReturnType<typeof createProfileService>;
