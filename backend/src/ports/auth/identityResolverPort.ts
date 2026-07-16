export interface IdentityResolverPort {
  /**
   * Resolves the canonical Firebase-managed `uid` for a Google identity —
   * an existing user is matched by email; a first-time signer-in gets a
   * fresh `uid` minted, exactly as the Firebase Auth client SDK did
   * implicitly before this feature (research.md R3b).
   */
  resolveOrCreateUser(identity: {
    email: string;
    name?: string;
    picture?: string;
  }): Promise<{ uid: string }>;
}
