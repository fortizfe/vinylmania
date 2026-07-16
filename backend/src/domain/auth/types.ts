export interface AuthenticatedUser {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
}
