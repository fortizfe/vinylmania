export interface AuthenticatedUser {
  uid: string;
  // Only `uid` is guaranteed once verification is session-based (feature
  // 051): no route besides the retired `POST /api/auth/session` handler
  // ever read anything else off `req.auth`.
  email?: string;
  name?: string;
  picture?: string;
}

/** Which OAuth client started a sign-in or Discogs link: the web SPA or the native app. */
export type OAuthClient = 'web' | 'native';
