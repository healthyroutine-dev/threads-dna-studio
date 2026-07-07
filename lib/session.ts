// httpOnly 쿠키 세션 — SESSION_SECRET으로 HMAC 서명
import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { sessionSecret } from './env';

const COOKIE = 'tds_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30일

function sign(value: string): string {
  return createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

export async function createSession(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, `${userId}.${sign(userId)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE,
    path: '/',
  });
}

export async function getSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf('.');
  if (dot < 0) return null;
  const userId = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = sign(userId);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
