// 만료 7일 전 장기 토큰 자동 갱신 (vercel.json cron이 매일 호출)
import { isMockThreads } from '@/lib/env';
import { getStore } from '@/lib/store';
import { refreshLongLivedToken } from '@/lib/threads';

export async function GET() {
  if (isMockThreads()) {
    return Response.json({ ok: true, refreshed: 0, mock: true });
  }
  const store = await getStore();
  const soon = new Date(Date.now() + 7 * 86400_000).toISOString();
  const expiring = await store.getTokensExpiringBefore(soon);
  let refreshed = 0;
  const errors: string[] = [];
  for (const t of expiring) {
    try {
      const r = await refreshLongLivedToken(t.access_token);
      await store.saveToken({ user_id: t.user_id, access_token: r.accessToken, expires_at: r.expiresAt });
      refreshed++;
    } catch (e) {
      errors.push(`${t.user_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return Response.json({ ok: errors.length === 0, refreshed, errors });
}
