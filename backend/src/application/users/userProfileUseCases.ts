import type { ThemePreference, UserProfile, VerifiedIdentity } from '../../domain/users/types';
import type { UserRepositoryPort } from '../../ports/users/userRepositoryPort';

export function createUserProfileUseCases(deps: { userRepository: UserRepositoryPort }) {
  async function createOrRefreshSession(identity: VerifiedIdentity): Promise<UserProfile> {
    const existing = await deps.userRepository.findByUid(identity.uid);
    if (!existing) {
      return deps.userRepository.create({
        uid: identity.uid,
        displayName: identity.displayName,
        email: identity.email,
        photoURL: identity.photoURL,
      });
    }
    return deps.userRepository.touchLastSignIn(identity.uid);
  }

  function getUserProfile(uid: string): Promise<UserProfile | null> {
    return deps.userRepository.findByUid(uid);
  }

  function updateThemePreference(
    uid: string,
    themePreference: ThemePreference,
  ): Promise<UserProfile> {
    return deps.userRepository.updateThemePreference(uid, themePreference);
  }

  return { createOrRefreshSession, getUserProfile, updateThemePreference };
}
