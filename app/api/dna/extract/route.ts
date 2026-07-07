// ★ DNA 추출 실행 (설계문서 6장 파이프라인)
import { NextRequest } from 'next/server';
import { getCurrentUser, unauthorized } from '@/lib/auth';
import { MIN_POSTS, extractDna, provisionalDna } from '@/lib/dna';
import { checkAndConsumeQuota, quotaExceeded } from '@/lib/quota';
import { getStore } from '@/lib/store';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const store = await getStore();
  const [posts, insights, prev] = await Promise.all([
    store.getPosts(user.id),
    store.getInsights(user.id),
    store.getLatestDna(user.id),
  ]);
  const withText = posts.filter((p) => p.text.trim().length > 0);

  // 데이터 부족 모드: 글 15개 미만 → 톤 질문 3개 답변으로 임시 DNA
  if (withText.length < MIN_POSTS) {
    const body = await req.json().catch(() => null);
    const a = body?.tone_answers;
    if (!a?.tone || !a?.emoji || !a?.topic) {
      return Response.json(
        { needToneAnswers: true, postCount: withText.length, minPosts: MIN_POSTS },
        { status: 422 }
      );
    }
    const dna = provisionalDna(user, a, withText.length, prev?.version ?? 0);
    dna.user_edits = prev?.user_edits ?? {};
    await store.saveDna(user.id, dna);
    return Response.json({ dna });
  }

  const q = await checkAndConsumeQuota(user.id);
  if (!q.ok) return quotaExceeded(q.used, q.limit);

  try {
    const dna = await extractDna(user, withText, insights, prev);
    await store.saveDna(user.id, dna);
    return Response.json({ dna });
  } catch (e) {
    console.error('DNA 추출 실패:', e);
    return Response.json({ error: `DNA 추출에 실패했어요: ${e instanceof Error ? e.message : e}` }, { status: 500 });
  }
}
