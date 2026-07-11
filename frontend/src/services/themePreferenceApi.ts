import { authorizedFetch } from './apiClient';

export type ThemePreference = 'light' | 'dark';

export async function setThemePreference(themePreference: ThemePreference): Promise<void> {
  await authorizedFetch('/api/auth/preferences', {
    method: 'PATCH',
    body: JSON.stringify({ themePreference }),
  });
}
