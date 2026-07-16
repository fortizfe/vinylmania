export type ThemePreference = 'light' | 'dark';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  createdAt: string;
  lastSignInAt: string;
  themePreference?: ThemePreference;
}

export interface VerifiedIdentity {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}
