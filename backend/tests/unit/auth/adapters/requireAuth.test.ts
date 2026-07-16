import type { NextFunction, Request, Response } from 'express';

import { createRequireAuth } from '../../../../src/adapters/auth/requireAuth';
import type { AuthenticatedUser } from '../../../../src/domain/auth/types';
import type { AuthVerifierPort } from '../../../../src/ports/auth/authVerifierPort';

function fakeAuthVerifier(overrides: Partial<jest.Mocked<AuthVerifierPort>> = {}): jest.Mocked<AuthVerifierPort> {
  return {
    verifyIdToken: jest.fn(),
    ...overrides,
  };
}

function mockRes() {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq(authorizationHeader?: string): Request {
  return {
    path: '/api/test',
    headers: authorizationHeader ? { authorization: authorizationHeader } : {},
  } as unknown as Request;
}

const authenticatedUser: AuthenticatedUser = {
  uid: 'uid-1',
  email: 'jane@example.com',
  name: 'Jane Doe',
  picture: 'https://example.com/p.png',
};

describe('createRequireAuth', () => {
  it('responds 401 without calling the port when the Authorization header is missing', async () => {
    const authVerifier = fakeAuthVerifier();
    const requireAuth = createRequireAuth({ authVerifier });
    const req = mockReq(undefined);
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(authVerifier.verifyIdToken).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'unauthorized' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 without calling the port when the Authorization header has no Bearer scheme', async () => {
    const authVerifier = fakeAuthVerifier();
    const requireAuth = createRequireAuth({ authVerifier });
    const req = mockReq('not-bearer-token');
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(authVerifier.verifyIdToken).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('sets req.auth and calls next() when the port resolves', async () => {
    const authVerifier = fakeAuthVerifier({
      verifyIdToken: jest.fn().mockResolvedValue(authenticatedUser),
    });
    const requireAuth = createRequireAuth({ authVerifier });
    const req = mockReq('Bearer valid-token');
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(authVerifier.verifyIdToken).toHaveBeenCalledWith('valid-token');
    expect(req.auth).toEqual(authenticatedUser);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('responds 401 with the existing error body when the port rejects', async () => {
    const authVerifier = fakeAuthVerifier({
      verifyIdToken: jest.fn().mockRejectedValue(new Error('invalid token')),
    });
    const requireAuth = createRequireAuth({ authVerifier });
    const req = mockReq('Bearer invalid-token');
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'unauthorized' }),
    );
  });
});
