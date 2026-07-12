import { getCurrentUser, unauthorized } from '@/lib/auth';
import { getStore } from '@/lib/store';

// 글 + 통계 조인 목록 (정렬·검색은 클라이언트에서)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const store = await getStore();
  const [posts, insights] = await Promise.all([store.getPosts(user.id), store.getInsights(user.id)]);
  const joined = posts.map((p) => ({
    ...p,
    insight: insights[p.id] ?? null,
  }));
  return Response.json({ posts: joined });
}
