import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { isMockThreads } from '@/lib/env';
import { createSession } from '@/lib/session';
import { getStore } from '@/lib/store';
import { MOCK_USER } from '@/lib/mock-data';
import { getAuthUrl } from '@/lib/threads';

export async function GET(req: NextRequest) {
  // 목업 모드: OAuth 없이 즉시 목업 계정으로 로그인
  if (isMockThreads()) {
    const store = await getStore();
    await store.upsertUser({ ...MOCK_USER });
    await store.saveToken({
      user_id: MOCK_USER.id,
      access_token: 'mock-token',
      expires_at: new Date(Date.now() + 60 * 86400_000).toISOString(),
    });
    await createSession(MOCK_USER.id);
    return NextResponse.redirect(new URL('/', req.url));
  }

  const state = randomBytes(16).toString('hex');
  const res = NextResponse.redirect(getAuthUrl(state));
  res.cookies.set('tds_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
  });
  return res;
}
