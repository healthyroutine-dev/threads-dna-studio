import { getCurrentUser, unauthorized } from '@/lib/auth';
import { getStore } from '@/lib/store';

// 동기화 진행률 조회
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const store = await getStore();
  const state = await store.getSyncState(user.id);
  return Response.json({ state });
}
