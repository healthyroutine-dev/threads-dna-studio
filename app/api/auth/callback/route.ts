import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/session';
import { getStore } from '@/lib/store';
import { exchangeCode, fetchProfile } from '@/lib/threads';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const savedState = req.cookies.get('tds_oauth_state')?.value;

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL('/login?error=oauth_state', req.url));
  }

  try {
    const { accessToken, userId, expiresAt } = await exchangeCode(code);
    const profile = await fetchProfile(accessToken);

    const store = await getStore();
    await store.upsertUser({
      id: userId,
      threads_user_id: userId,
      username: profile.username,
      name: profile.name,
      bio: profile.biography,
    });
    await store.saveToken({ user_id: userId, access_token: accessToken, expires_at: expiresAt });
    await createSession(userId);

    const res = NextResponse.redirect(new URL('/', req.url));
    res.cookies.delete('tds_oauth_state');
    return res;
  } catch (e) {
    console.error('OAuth callback 실패:', e);
    return NextResponse.redirect(new URL('/login?error=oauth_failed', req.url));
  }
}
