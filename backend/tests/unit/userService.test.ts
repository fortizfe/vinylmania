import {
  clearEmulatorFirestore,
  clearEmulatorUsers,
  getTestIdToken,
} from '../helpers/authEmulator';
import { getOrCreateUser, getUser, updateThemePreference } from '../../src/services/userService';

describe('userService — theme preference', () => {
  afterEach(async () => {
    await clearEmulatorUsers();
    await clearEmulatorFirestore();
  });

  it('omits themePreference entirely when it was never set', async () => {
    const { uid } = await getTestIdToken('theme-unset', { displayName: 'Jane Doe' });
    await getOrCreateUser({ uid, email: 'theme-unset@example.com', displayName: 'Jane Doe' });

    const user = await getUser(uid);

    expect(user).not.toBeNull();
    expect(user).not.toHaveProperty('themePreference');
  });

  it('updateThemePreference writes only the themePreference field and returns the updated profile', async () => {
    const { uid } = await getTestIdToken('theme-write', { displayName: 'Jane Doe' });
    await getOrCreateUser({ uid, email: 'theme-write@example.com', displayName: 'Jane Doe' });

    const updated = await updateThemePreference(uid, 'dark');

    expect(updated.themePreference).toBe('dark');
    expect(updated.displayName).toBe('Jane Doe');
    expect(updated.email).toBe('theme-write@example.com');

    const reFetched = await getUser(uid);
    expect(reFetched?.themePreference).toBe('dark');
  });

  it('getOrCreateUser preserves an existing themePreference across a normal sign-in update (FR-012)', async () => {
    const { uid } = await getTestIdToken('theme-preserve', { displayName: 'Jane Doe' });
    await getOrCreateUser({ uid, email: 'theme-preserve@example.com', displayName: 'Jane Doe' });
    await updateThemePreference(uid, 'dark');

    // Simulates a normal subsequent sign-in, which refreshes lastSignInAt.
    const resigned = await getOrCreateUser({
      uid,
      email: 'theme-preserve@example.com',
      displayName: 'Jane Doe',
    });

    expect(resigned.themePreference).toBe('dark');
  });
});
