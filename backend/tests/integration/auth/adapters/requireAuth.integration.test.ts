import type { NextFunction, Request, Response } from 'express';

import { requireAuth } from '../../../../src/adapters/auth/requireAuth';
import { clearEmulatorFirestore, clearEmulatorUsers, getTestIdToken } from '../../../helpers/authEmulator';
import { createTestSession } from '../../../helpers/testSession';

function mockRes() {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq(authorizationHeader?: string): Request {
  return {
    headers: authorizationHeader ? { authorization: authorizationHeader } : {},
  } as unknown as Request;
}

describe('requireAuth middleware (Firestore emulator)', () => {
  afterEach(async () => {
    await clearEmulatorFirestore();
  });

  afterAll(async () => {
    await clearEmulatorUsers();
  });

  it('calls next() and attaches req.auth for a valid session token', async () => {
    const { sessionToken, uid } = await createTestSession('valid-user');
    const req = mockReq(`Bearer ${sessionToken}`);
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.auth?.uid).toBe(uid);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('responds 401 when the Authorization header is missing', async () => {
    const req = mockReq(undefined);
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'unauthorized' }),
    );
  });

  it('responds 401 for a malformed token', async () => {
    const req = mockReq('Bearer not-a-real-token');
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('responds 401 when the Authorization header has no Bearer scheme', async () => {
    const { sessionToken } = await createTestSession('no-scheme-user');
    const req = mockReq(sessionToken);
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  // FR-019 / quickstart.md Scenario 7: once the backend verifies its own
  // sessions instead of Firebase ID tokens, a token that used to be valid
  // (minted via the retained `getTestIdToken`) MUST be rejected — treated
  // as an ordinary expired session, with no dual-verification path.
  it('responds 401 for a legacy Firebase ID token (no dual-verification window)', async () => {
    const { idToken } = await getTestIdToken('legacy-token-user');
    const req = mockReq(`Bearer ${idToken}`);
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
