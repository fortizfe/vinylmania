import { getFirebaseAuth } from '../../config/firebase-admin';
import type { IdentityResolverPort } from '../../ports/auth/identityResolverPort';

async function resolveOrCreateUser(identity: {
  email: string;
  name?: string;
  picture?: string;
}): Promise<{ uid: string }> {
  try {
    const existing = await getFirebaseAuth().getUserByEmail(identity.email);
    return { uid: existing.uid };
  } catch {
    const created = await getFirebaseAuth().createUser({
      email: identity.email,
      displayName: identity.name,
      photoURL: identity.picture,
    });
    return { uid: created.uid };
  }
}

export const firebaseIdentityResolverAdapter: IdentityResolverPort = { resolveOrCreateUser };
