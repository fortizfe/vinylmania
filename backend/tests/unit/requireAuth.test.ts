import type { NextFunction, Request, Response } from 'express';

import { requireAuth } from '../../src/middleware/requireAuth';
import { clearEmulatorUsers, getTestIdToken } from '../helpers/authEmulator';

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

describe('requireAuth middleware', () => {
  afterAll(async () => {
    await clearEmulatorUsers();
  });

  it('calls next() and attaches req.auth for a valid token', async () => {
    const { idToken, uid } = await getTestIdToken('valid-user');
    const req = mockReq(`Bearer ${idToken}`);
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
    const { idToken } = await getTestIdToken('no-scheme-user');
    const req = mockReq(idToken);
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
