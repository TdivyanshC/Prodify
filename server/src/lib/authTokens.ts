import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTVerifyGetKey } from 'jose';
import { env } from '../config/env';
import { AppError, unauthorized } from './errors';

// Google sign-in without Firebase: the app gets a Google ID token from native
// Google Sign-In, we verify it here against Google's public keys, then hand
// back our own session token. Every later request carries only ours.

let googleKeys: JWTVerifyGetKey = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

// Tests only: verify "Google" ID tokens against a local key set, since a real
// one needs a phone and a Google account. Refused outside NODE_ENV=test.
export function useGoogleKeysForTests(keys: JWTVerifyGetKey) {
  if (env.NODE_ENV !== 'test') throw new Error('useGoogleKeysForTests is test-only');
  googleKeys = keys;
}
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export interface GoogleIdentity {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  if (!env.GOOGLE_WEB_CLIENT_ID) throw new AppError(503, 'GOOGLE_AUTH_NOT_CONFIGURED', 'GOOGLE_WEB_CLIENT_ID is not set on the server');
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, googleKeys, { issuer: GOOGLE_ISSUERS, audience: env.GOOGLE_WEB_CLIENT_ID }));
  } catch {
    throw unauthorized('Google sign-in could not be verified');
  }
  // Native Android sign-in sets azp to the Android client; web sign-in to the web one.
  const allowedAzp = [env.GOOGLE_WEB_CLIENT_ID, env.GOOGLE_ANDROID_CLIENT_ID].filter(Boolean);
  if (env.GOOGLE_ANDROID_CLIENT_ID && payload.azp && !allowedAzp.includes(payload.azp as string)) {
    throw unauthorized('Google sign-in came from an unknown client');
  }
  if (!payload.sub || typeof payload.email !== 'string' || payload.email_verified !== true) {
    throw unauthorized('Google account has no verified email');
  }
  return {
    sub: payload.sub,
    email: payload.email,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    picture: typeof payload.picture === 'string' ? payload.picture : undefined,
  };
}

const ISSUER = 'prodify';
const SESSION_TTL = '30d';
const key = new TextEncoder().encode(env.JWT_SECRET);

// uid = users.firebaseUid (the account's auth identity), sid = authSessions._id
// so a sign-out on one device revokes just that device.
export function issueSessionToken(uid: string, sid: string): Promise<string> {
  return new SignJWT({ sid }).setProtectedHeader({ alg: 'HS256' }).setSubject(uid).setIssuer(ISSUER).setIssuedAt().setExpirationTime(SESSION_TTL).sign(key);
}

export async function verifySessionToken(token: string): Promise<{ uid: string; sid: string }> {
  try {
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER, algorithms: ['HS256'] });
    if (!payload.sub || typeof payload.sid !== 'string') throw new Error('malformed');
    return { uid: payload.sub, sid: payload.sid };
  } catch {
    throw unauthorized('Session expired — sign in again');
  }
}
