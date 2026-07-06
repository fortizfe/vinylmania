import {
  buildAccessTokenHeader,
  buildIdentityHeader,
  buildProtectedResourceHeader,
  buildRequestTokenHeader,
} from '../../src/discogs/oauth/oauthSignature';

const CREDENTIALS = { consumerKey: 'test-key', consumerSecret: 'test-secret' };

/** Parses `OAuth k1="v1", k2="v2"` into a map. */
function parseOauthHeader(header: string): Record<string, string> {
  expect(header.startsWith('OAuth ')).toBe(true);
  const params: Record<string, string> = {};
  for (const pair of header.slice('OAuth '.length).split(', ')) {
    const match = /^([a-z_]+)="([^"]*)"$/.exec(pair);
    expect(match).not.toBeNull();
    params[match![1]] = match![2];
  }
  return params;
}

describe('buildRequestTokenHeader', () => {
  it('includes consumer key, PLAINTEXT method, callback, and consumer-secret-only signature', () => {
    const header = buildRequestTokenHeader(CREDENTIALS, 'http://localhost:5173/callback');
    const params = parseOauthHeader(header);

    expect(params.oauth_consumer_key).toBe('test-key');
    expect(params.oauth_signature_method).toBe('PLAINTEXT');
    expect(params.oauth_signature).toBe('test-secret&');
    expect(params.oauth_callback).toBe('http://localhost:5173/callback');
    expect(params.oauth_nonce).toBeTruthy();
    expect(Number(params.oauth_timestamp)).toBeGreaterThan(0);
    expect(params.oauth_token).toBeUndefined();
    expect(params.oauth_verifier).toBeUndefined();
  });

  it('generates a unique nonce per call', () => {
    const first = parseOauthHeader(buildRequestTokenHeader(CREDENTIALS, 'cb'));
    const second = parseOauthHeader(buildRequestTokenHeader(CREDENTIALS, 'cb'));
    expect(first.oauth_nonce).not.toBe(second.oauth_nonce);
  });

  it('uses the current unix timestamp', () => {
    const before = Math.floor(Date.now() / 1000);
    const params = parseOauthHeader(buildRequestTokenHeader(CREDENTIALS, 'cb'));
    const after = Math.floor(Date.now() / 1000);
    expect(Number(params.oauth_timestamp)).toBeGreaterThanOrEqual(before);
    expect(Number(params.oauth_timestamp)).toBeLessThanOrEqual(after);
  });
});

describe('buildAccessTokenHeader', () => {
  it('includes request token, verifier, and consumer+request-secret signature', () => {
    const header = buildAccessTokenHeader(CREDENTIALS, {
      token: 'req-token',
      tokenSecret: 'req-secret',
      verifier: 'the-verifier',
    });
    const params = parseOauthHeader(header);

    expect(params.oauth_consumer_key).toBe('test-key');
    expect(params.oauth_signature_method).toBe('PLAINTEXT');
    expect(params.oauth_token).toBe('req-token');
    expect(params.oauth_verifier).toBe('the-verifier');
    expect(params.oauth_signature).toBe('test-secret&req-secret');
    expect(params.oauth_callback).toBeUndefined();
  });
});

describe('buildIdentityHeader', () => {
  it('includes access token and consumer+access-secret signature, no verifier', () => {
    const header = buildIdentityHeader(CREDENTIALS, {
      token: 'access-token',
      tokenSecret: 'access-secret',
    });
    const params = parseOauthHeader(header);

    expect(params.oauth_consumer_key).toBe('test-key');
    expect(params.oauth_signature_method).toBe('PLAINTEXT');
    expect(params.oauth_token).toBe('access-token');
    expect(params.oauth_signature).toBe('test-secret&access-secret');
    expect(params.oauth_verifier).toBeUndefined();
    expect(params.oauth_callback).toBeUndefined();
  });
});

describe('buildProtectedResourceHeader', () => {
  it('signs an arbitrary protected-resource request with the access token pair', () => {
    const header = buildProtectedResourceHeader(CREDENTIALS, {
      token: 'access-token',
      tokenSecret: 'access-secret',
    });
    const params = parseOauthHeader(header);

    expect(params.oauth_consumer_key).toBe('test-key');
    expect(params.oauth_signature_method).toBe('PLAINTEXT');
    expect(params.oauth_token).toBe('access-token');
    expect(params.oauth_signature).toBe('test-secret&access-secret');
    expect(params.oauth_nonce).toBeTruthy();
    expect(Number(params.oauth_timestamp)).toBeGreaterThan(0);
    expect(params.oauth_verifier).toBeUndefined();
    expect(params.oauth_callback).toBeUndefined();
  });

  it('generates a unique nonce per call', () => {
    const access = { token: 't', tokenSecret: 's' };
    const first = parseOauthHeader(buildProtectedResourceHeader(CREDENTIALS, access));
    const second = parseOauthHeader(buildProtectedResourceHeader(CREDENTIALS, access));
    expect(first.oauth_nonce).not.toBe(second.oauth_nonce);
  });
});
