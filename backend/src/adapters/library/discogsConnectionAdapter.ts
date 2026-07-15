import {
  getConnection,
  markInitialLibrarySync,
} from '../../discogs/oauth/discogsOauthService';
import type { DiscogsConnectionPort } from '../../ports/library/discogsConnectionPort';

export const discogsConnectionAdapter: DiscogsConnectionPort = {
  getConnection,
  markInitialLibrarySync,
};
