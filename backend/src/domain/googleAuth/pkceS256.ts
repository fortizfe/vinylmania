import { createHash } from 'node:crypto';

/** RFC 7636 S256: `base64url(sha256(verifier)) === challenge`. The challenge is not secret, so plain equality is fine. */
export function matchesPkceS256(verifier: string, challenge: string): boolean {
  return createHash('sha256').update(verifier).digest('base64url') === challenge;
}
