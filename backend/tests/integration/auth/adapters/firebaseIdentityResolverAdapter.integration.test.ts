import { getFirebaseAuth } from '../../../../src/config/firebase-admin';
import { firebaseIdentityResolverAdapter } from '../../../../src/adapters/auth/firebaseIdentityResolverAdapter';
import { clearEmulatorUsers } from '../../../helpers/authEmulator';

const { resolveOrCreateUser } = firebaseIdentityResolverAdapter;

describe('firebaseIdentityResolverAdapter (Auth emulator)', () => {
  afterEach(async () => {
    await clearEmulatorUsers();
  });

  it('resolves the same uid for an existing user matched by email', async () => {
    const existing = await getFirebaseAuth().createUser({
      email: 'existing-user@example.com',
      displayName: 'Existing User',
    });

    const result = await resolveOrCreateUser({
      email: 'existing-user@example.com',
      name: 'Existing User (via Google)',
    });

    expect(result.uid).toBe(existing.uid);
  });

  it('creates a fresh Firebase user (and uid) for a first-time email', async () => {
    const result = await resolveOrCreateUser({
      email: 'brand-new-user@example.com',
      name: 'Brand New User',
      picture: 'https://example.com/p.png',
    });

    expect(result.uid).toBeTruthy();
    const created = await getFirebaseAuth().getUser(result.uid);
    expect(created.email).toBe('brand-new-user@example.com');
    expect(created.displayName).toBe('Brand New User');
  });
});
