import { matchesPkceS256 } from '../../../../src/domain/googleAuth/pkceS256';

// RFC 7636 Appendix B
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

describe('matchesPkceS256', () => {
  it('accepts the RFC 7636 Appendix B verifier/challenge pair', () => {
    expect(matchesPkceS256(VERIFIER, CHALLENGE)).toBe(true);
  });

  it('rejects a verifier that does not hash to the challenge', () => {
    expect(matchesPkceS256(`${VERIFIER}x`, CHALLENGE)).toBe(false);
    expect(matchesPkceS256(VERIFIER, 'short')).toBe(false);
  });
});
