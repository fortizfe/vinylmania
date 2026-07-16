import type { ThemePreference, UserProfile } from '../../domain/users/types';

export interface UserRepositoryPort {
  /** Returns null when no `users/{uid}` document exists yet. */
  findByUid(uid: string): Promise<UserProfile | null>;

  /**
   * Creates a new `users/{uid}` document. `createdAt` and `lastSignInAt` are
   * both set by the adapter at write time (server timestamp) — callers do
   * not supply them.
   */
  create(profile: {
    uid: string;
    displayName: string;
    email: string;
    photoURL?: string;
  }): Promise<UserProfile>;

  /**
   * Updates only `lastSignInAt` on an existing `users/{uid}` document.
   * MUST NOT write `displayName`, `email`, `photoURL`, or `themePreference`
   * — a repeat sign-in leaves every other field exactly as it was.
   */
  touchLastSignIn(uid: string): Promise<UserProfile>;

  /** Updates only `themePreference` on an existing `users/{uid}` document. */
  updateThemePreference(uid: string, themePreference: ThemePreference): Promise<UserProfile>;
}
