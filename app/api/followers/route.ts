import { getCurrentUser, getCurrentUserWithToken, unauthorized } from '@/lib/auth';
import { isMockThreads } from '@/lib/env';
import { mockAccountViewsOn, mockFollowersOn } from '@/lib/mock-data';
import { getStore } from '@/lib/store';
import { fetchAccountInsights } from '@/lib/threads';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const store = await getStore();
  const snapshots = await store.getSnapshots(user.id);
  return Response.json({ snapshots });
}

// 오늘 스냅샷 기록 (성장 탭 방문 시 자동 호출)
export async function POST() {
  const auth = await getCurrentUserWithToken();
  if (!auth) return unauthorized();
  const { user, token } = auth;
  const store = await getStore();

  // 목업 모드: 첫 방문이면 지난 30일 히스토리를 채워 차트를 보여준다
  if (isMockThreads()) {
    const existing = await store.getSnapshots(user.id);
    if (existing.length === 0) {
      for (let d = 30; d >= 1; d--) {
        const day = new Date(Date.now() - d * 86400_000);
        await store.upsertSnapshot({
          user_id: user.id,
          date: day.toISOString().slice(0, 10),
          followers_count: mockFollowersOn(day),
          views: mockAccountViewsOn(day),
        });
      }
    }
  }

  const { followersCount, views } = await fetchAccountInsights(token.access_token);
  await store.upsertSnapshot({
    user_id: user.id,
    date: new Date().toISOString().slice(0, 10),
    followers_count: followersCount,
    views,
  });
  const snapshots = await store.getSnapshots(user.id);
  return Response.json({ snapshots });
}
