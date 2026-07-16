import { getFirebaseAuth } from '../../config/firebase-admin';
import type { AuthenticatedUser } from '../../domain/auth/types';
import type { AuthVerifierPort } from '../../ports/auth/authVerifierPort';

async function verifyIdToken(idToken: string): Promise<AuthenticatedUser> {
  const decoded = await getFirebaseAuth().verifyIdToken(idToken);
  return {
    uid: decoded.uid,
    email: decoded.email ?? '',
    name: decoded.name,
    picture: decoded.picture,
  };
}

export const firebaseAuthVerifierAdapter: AuthVerifierPort = { verifyIdToken };
