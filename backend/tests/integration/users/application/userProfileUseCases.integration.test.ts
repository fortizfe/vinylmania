import { firestoreUserRepository } from '../../../../src/adapters/users/firestoreUserRepository';
import { createUserProfileUseCases } from '../../../../src/application/users/userProfileUseCases';
import {
  clearEmulatorFirestore,
  clearEmulatorUsers,
  getTestIdToken,
} from '../../../helpers/authEmulator';

const { createOrRefreshSession, getUserProfile, updateThemePreference } = createUserProfileUseCases({
  userRepository: firestoreUserRepository,
});

describe('userProfileUseCases — theme preference (Firestore emulator)', () => {
  afterEach(async () => {
    await clearEmulatorUsers();
    await clearEmulatorFirestore();
  });

  it('omits themePreference entirely when it was never set', async () => {
    const { uid } = await getTestIdToken('theme-unset', { displayName: 'Jane Doe' });
    await createOrRefreshSession({ uid, email: 'theme-unset@example.com', displayName: 'Jane Doe' });

    const user = await getUserProfile(uid);

    expect(user).not.toBeNull();
    expect(user).not.toHaveProperty('themePreference');
  });

  it('updateThemePreference writes only the themePreference field and returns the updated profile', async () => {
    const { uid } = await getTestIdToken('theme-write', { displayName: 'Jane Doe' });
    await createOrRefreshSession({ uid, email: 'theme-write@example.com', displayName: 'Jane Doe' });

    const updated = await updateThemePreference(uid, 'dark');

    expect(updated.themePreference).toBe('dark');
    expect(updated.displayName).toBe('Jane Doe');
    expect(updated.email).toBe('theme-write@example.com');

    const reFetched = await getUserProfile(uid);
    expect(reFetched?.themePreference).toBe('dark');
  });

  it('createOrRefreshSession preserves an existing themePreference across a normal sign-in update (research.md Decision 5)', async () => {
    const { uid } = await getTestIdToken('theme-preserve', { displayName: 'Jane Doe' });
    await createOrRefreshSession({ uid, email: 'theme-preserve@example.com', displayName: 'Jane Doe' });
    await updateThemePreference(uid, 'dark');

    // Simulates a normal subsequent sign-in, which refreshes lastSignInAt.
    const resigned = await createOrRefreshSession({
      uid,
      email: 'theme-preserve@example.com',
      displayName: 'Jane Doe',
    });

    expect(resigned.themePreference).toBe('dark');
  });
});
