import type { DiscogsConnection } from '../../discogs/oauth/types';

export interface DiscogsConnectionPort {
  /** Returns null when the user has no Discogs account linked. */
  getConnection(uid: string): Promise<DiscogsConnection | null>;

  /**
   * Marks a connection's first library synchronization (union-merge + legacy
   * migration) as completed; every later sync for this user runs in mirror
   * mode. Called only when a first sync completes with zero failures.
   */
  markInitialLibrarySync(uid: string): Promise<void>;
}
