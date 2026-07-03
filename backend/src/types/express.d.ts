export interface AuthenticatedUser {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthenticatedUser;
    }
  }
}

export {};
