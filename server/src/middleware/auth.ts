import type { NextFunction, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { env } from '../config/env';
import { col } from '../db/mongo';
import type { UserDoc } from '../db/schemas';
import { verifySessionToken } from '../lib/authTokens';
import { forbidden, unauthorized } from '../lib/errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserDoc;
      firebaseUid?: string;
      authSessionId?: ObjectId;
      requestId?: string;
    }
  }
}

// Token → identity. Prodify session tokens (POST /auth/google) work in every
// mode; "dev:<uid>" (seed users are seed-<handle>) only in AUTH_MODE=dev.
export async function verifyToken(token: string | undefined): Promise<{ uid: string; sid?: string }> {
  if (!token) throw unauthorized();
  if (token.startsWith('dev:')) {
    if (env.AUTH_MODE !== 'dev') throw unauthorized('Dev tokens are disabled');
    if (token.length < 5) throw unauthorized('Dev tokens look like "dev:<uid>"');
    return { uid: token.slice(4) };
  }
  return verifySessionToken(token);
}

function assertActive(user: UserDoc) {
  if (user.status !== 'active') throw forbidden('ACCOUNT_' + user.status.toUpperCase(), `This account is ${user.status}`);
}

// A session token is only good while its authSessions row is unrevoked, so
// signing out on one device ends that device's token immediately.
async function resolveSession(token: string | undefined): Promise<{ user: UserDoc; sid?: ObjectId }> {
  const { uid, sid } = await verifyToken(token?.replace(/^Bearer\s+/i, ''));
  const user = await col('users').findOne({ firebaseUid: uid });
  if (!user) throw unauthorized('No account yet — call POST /v1/auth/session first');
  assertActive(user);
  if (!sid) return { user };
  const sessionId = ObjectId.isValid(sid) ? new ObjectId(sid) : null;
  const session = sessionId && (await col('authSessions').findOne({ _id: sessionId, userId: user._id, revokedAt: null }));
  if (!session) throw unauthorized('Signed out on this device — sign in again');
  return { user, sid: sessionId };
}

export async function resolveUserFromToken(token: string | undefined): Promise<UserDoc> {
  return (await resolveSession(token)).user;
}

const bearer = (req: Request) => req.header('authorization')?.replace(/^Bearer\s+/i, '');

// Every authenticated route: valid token + existing, active account.
export async function requireUser(req: Request, _res: Response, next: NextFunction) {
  const { user, sid } = await resolveSession(bearer(req));
  req.user = user;
  req.authSessionId = sid;
  next();
}

// /auth/session only: valid token, account may not exist yet (dev accounts).
// A session token's account always exists — it must also be unrevoked, or
// the device upsert would quietly revive a signed-out session.
export async function requireToken(req: Request, _res: Response, next: NextFunction) {
  const { uid, sid } = await verifyToken(bearer(req));
  if (sid) req.authSessionId = (await resolveSession(bearer(req))).sid;
  req.firebaseUid = uid;
  const existing = await col('users').findOne({ firebaseUid: uid });
  if (existing) assertActive(existing);
  next();
}

export const me = (req: Request): UserDoc => {
  if (!req.user) throw unauthorized();
  return req.user;
};
export const meId = (req: Request): ObjectId => me(req)._id;
