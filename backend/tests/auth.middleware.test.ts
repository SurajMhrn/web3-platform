import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { authenticateJWT, authorize, AuthRequest, JwtPayload } from '../src/middleware/auth.middleware';
import { env } from '../src/config/env';

const makeRes = () => {
  const res: Partial<Response> = {
    sendStatus: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as Response;
};

describe('authenticateJWT', () => {
  it('rejects a request with no accessToken cookie', () => {
    const req = { cookies: {} } as AuthRequest;
    const res = makeRes();
    const next = jest.fn();

    authenticateJWT(req, res, next);

    expect(res.sendStatus).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a malformed/invalid token', () => {
    const req = { cookies: { accessToken: 'not-a-real-token' } } as unknown as AuthRequest;
    const res = makeRes();
    const next = jest.fn();

    authenticateJWT(req, res, next);

    expect(res.sendStatus).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a token signed with the wrong secret', () => {
    const badToken = jwt.sign({ id: '1', email: 'a@b.com', role: 'user' }, 'wrong-secret');
    const req = { cookies: { accessToken: badToken } } as unknown as AuthRequest;
    const res = makeRes();
    const next = jest.fn();

    authenticateJWT(req, res, next);

    expect(res.sendStatus).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a valid token and attaches req.user', () => {
    const payload: JwtPayload = { id: '1', email: 'a@b.com', role: 'admin' };
    const token = jwt.sign(payload, env.jwtSecret, { expiresIn: '15m' });
    const req = { cookies: { accessToken: token } } as unknown as AuthRequest;
    const res = makeRes();
    const next = jest.fn();

    authenticateJWT(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject(payload);
  });
});

describe('authorize', () => {
  it('rejects when req.user is missing', () => {
    const req = {} as AuthRequest;
    const res = makeRes();
    const next = jest.fn();

    authorize('admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a role not in the allow-list', () => {
    const req = { user: { id: '1', email: 'a@b.com', role: 'user' } } as AuthRequest;
    const res = makeRes();
    const next = jest.fn();

    authorize('admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a role in the allow-list', () => {
    const req = { user: { id: '1', email: 'a@b.com', role: 'admin' } } as AuthRequest;
    const res = makeRes();
    const next = jest.fn();

    authorize('admin', 'moderator')(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
