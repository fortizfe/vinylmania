import { logger } from '../../config/logger';
import { GoogleAuthFlowError } from '../../domain/googleAuth/googleAuthErrors';
import type { VerifiedIdentity, UserProfile } from '../../domain/users/types';
import type { IdentityResolverPort } from '../../ports/auth/identityResolverPort';
import type { SessionStorePort } from '../../ports/auth/sessionStorePort';
import type { GoogleIdentityPort } from '../../ports/googleAuth/googleIdentityPort';

export interface CompleteLoginInput {
  state: string;
  code?: string;
  denied?: boolean;
}

export interface CompleteLoginResult {
  sessionToken: string;
  user: UserProfile;
}

export function createCompleteLoginUseCase(deps: {
  googleIdentity: GoogleIdentityPort;
  identityResolver: IdentityResolverPort;
  sessionStore: SessionStorePort;
  syncUserProfile: (identity: VerifiedIdentity) => Promise<UserProfile>;
}) {
  return async function completeLogin(input: CompleteLoginInput): Promise<CompleteLoginResult> {
    if (input.denied) {
      throw new GoogleAuthFlowError('denied', 'Sign-in was cancelled.');
    }

    const pending = await deps.googleIdentity.getPendingLogin(input.state);
    if (!pending) {
      logger.warn({ route: 'google-auth', outcome: 'login_failed', message: 'unknown or already-consumed state' });
      throw new GoogleAuthFlowError('invalid_state', 'This sign-in attempt is not valid. Please try signing in again.');
    }

    if (new Date(pending.expiresAt).getTime() < Date.now()) {
      await deps.googleIdentity.deletePendingLogin(input.state);
      logger.warn({ route: 'google-auth', outcome: 'login_failed', message: 'sign-in attempt expired' });
      throw new GoogleAuthFlowError('expired_state', 'This sign-in attempt expired. Please try signing in again.');
    }

    const identity = await deps.googleIdentity.exchangeCodeForIdentity(input.code!);
    const { uid } = await deps.identityResolver.resolveOrCreateUser({
      email: identity.email,
      name: identity.name,
      picture: identity.picture,
    });

    const user = await deps.syncUserProfile({
      uid,
      email: identity.email,
      displayName: identity.name ?? identity.email,
      photoURL: identity.picture,
    });

    const session = await deps.sessionStore.createSession(uid);
    await deps.googleIdentity.deletePendingLogin(input.state);

    logger.info({ route: 'google-auth', outcome: 'login_completed', uid });

    return { sessionToken: session.sessionId, user };
  };
}
