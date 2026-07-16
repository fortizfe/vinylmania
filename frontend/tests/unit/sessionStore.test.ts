import { beforeEach, describe, expect, it } from 'vitest';

import { clearSessionToken, getSessionToken, setSessionToken } from '../../src/services/sessionStore';

describe('sessionStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no token has been stored', () => {
    expect(getSessionToken()).toBeNull();
  });

  it('persists a token across get calls once set', () => {
    setSessionToken('abc123');
    expect(getSessionToken()).toBe('abc123');
  });

  it('clears the stored token', () => {
    setSessionToken('abc123');
    clearSessionToken();
    expect(getSessionToken()).toBeNull();
  });
});
