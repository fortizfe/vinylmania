export interface GoogleIdentity {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

export interface PendingGoogleLogin {
  state: string;
  createdAt: string;
  expiresAt: string;
}
