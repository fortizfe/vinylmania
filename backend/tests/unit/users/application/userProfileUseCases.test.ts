import { createUserProfileUseCases } from '../../../../src/application/users/userProfileUseCases';
import type { UserProfile, VerifiedIdentity } from '../../../../src/domain/users/types';
import type { UserRepositoryPort } from '../../../../src/ports/users/userRepositoryPort';

function fakeRepository(overrides: Partial<jest.Mocked<UserRepositoryPort>> = {}): jest.Mocked<UserRepositoryPort> {
  return {
    findByUid: jest.fn(),
    create: jest.fn(),
    touchLastSignIn: jest.fn(),
    updateThemePreference: jest.fn(),
    ...overrides,
  };
}

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    uid: 'uid-1',
    displayName: 'Jane Doe',
    email: 'jane@example.com',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastSignInAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function identity(overrides: Partial<VerifiedIdentity> = {}): VerifiedIdentity {
  return {
    uid: 'uid-1',
    email: 'jane@example.com',
    displayName: 'Jane Doe',
    ...overrides,
  };
}

describe('createUserProfileUseCases', () => {
  describe('createOrRefreshSession', () => {
    it('creates the profile when no existing document is found', async () => {
      const repository = fakeRepository({
        findByUid: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(profile()),
      });
      const { createOrRefreshSession } = createUserProfileUseCases({ userRepository: repository });

      const result = await createOrRefreshSession(identity({ photoURL: 'https://example.com/p.png' }));

      expect(repository.create).toHaveBeenCalledWith({
        uid: 'uid-1',
        displayName: 'Jane Doe',
        email: 'jane@example.com',
        photoURL: 'https://example.com/p.png',
      });
      expect(repository.touchLastSignIn).not.toHaveBeenCalled();
      expect(result).toEqual(profile());
    });

    it('touches only lastSignInAt when a document already exists, never creating a new one', async () => {
      const existing = profile({ themePreference: 'dark' });
      const repository = fakeRepository({
        findByUid: jest.fn().mockResolvedValue(existing),
        touchLastSignIn: jest.fn().mockResolvedValue({ ...existing, lastSignInAt: '2026-01-02T00:00:00.000Z' }),
      });
      const { createOrRefreshSession } = createUserProfileUseCases({ userRepository: repository });

      const result = await createOrRefreshSession(identity());

      expect(repository.touchLastSignIn).toHaveBeenCalledWith('uid-1');
      expect(repository.create).not.toHaveBeenCalled();
      expect(result.themePreference).toBe('dark');
      expect(result.lastSignInAt).toBe('2026-01-02T00:00:00.000Z');
    });
  });

  describe('getUserProfile', () => {
    it('calls findByUid directly and returns its result', async () => {
      const repository = fakeRepository({ findByUid: jest.fn().mockResolvedValue(profile()) });
      const { getUserProfile } = createUserProfileUseCases({ userRepository: repository });

      const result = await getUserProfile('uid-1');

      expect(repository.findByUid).toHaveBeenCalledWith('uid-1');
      expect(result).toEqual(profile());
    });

    it('returns null when no profile exists', async () => {
      const repository = fakeRepository({ findByUid: jest.fn().mockResolvedValue(null) });
      const { getUserProfile } = createUserProfileUseCases({ userRepository: repository });

      const result = await getUserProfile('unknown-uid');

      expect(result).toBeNull();
    });
  });

  describe('updateThemePreference', () => {
    it('calls the port method of the same name directly', async () => {
      const repository = fakeRepository({
        updateThemePreference: jest.fn().mockResolvedValue(profile({ themePreference: 'dark' })),
      });
      const { updateThemePreference } = createUserProfileUseCases({ userRepository: repository });

      const result = await updateThemePreference('uid-1', 'dark');

      expect(repository.updateThemePreference).toHaveBeenCalledWith('uid-1', 'dark');
      expect(result.themePreference).toBe('dark');
    });
  });
});
