import { NextRequest } from 'next/server';
import { getCurrentUser, unauthorized } from '@/lib/auth';
import { applyUserEdits } from '@/lib/dna';
import { getStore } from '@/lib/store';

const EDITABLE = ['identity', 'tone_rules', 'signature_hook', 'winning_axes', 'weakness', 'style_anchors'] as const;

// 최신 DNA + 적용본 + 추출 근거(히트작 TOP10) + 업데이트 추천 여부
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const store = await getStore();
  const [dna, posts, insights] = await Promise.all([
    store.getLatestDna(user.id),
    store.getPosts(user.id),
    store.getInsights(user.id),
  ]);

  const withText = posts.filter((p) => p.text.trim().length > 0);
  const topPosts = withText
    .map((p) => ({ id: p.id, text: p.text, likes: insights[p.id]?.likes ?? 0, views: insights[p.id]?.views ?? 0, timestamp: p.timestamp, permalink: p.permalink }))
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 10);

  // 새 글 20개 이상 or 30일 경과 → 업데이트 추천 배지
  let updateRecommended = false;
  if (dna) {
    const newPosts = withText.filter((p) => p.timestamp > dna.extracted_at).length;
    const ageDays = (Date.now() - new Date(dna.extracted_at).getTime()) / 86400_000;
    updateRecommended = newPosts >= 20 || ageDays >= 30 || (dna.provisional === true && withText.length >= 15);
  }

  return Response.json({
    dna,
    effective: dna ? applyUserEdits(dna) : null,
    topPosts,
    postCount: withText.length,
    updateRecommended,
  });
}

// 항목별 인라인 수정 → user_edits에 저장 (자동 추출값보다 항상 우선)
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const store = await getStore();
  const dna = await store.getLatestDna(user.id);
  if (!dna) return Response.json({ error: '아직 추출된 DNA가 없어요.' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const field = body?.field as (typeof EDITABLE)[number];
  if (!body || !EDITABLE.includes(field)) {
    return Response.json({ error: '수정할 수 없는 항목이에요.' }, { status: 400 });
  }

  dna.user_edits = { ...dna.user_edits };
  if (body.reset === true) delete dna.user_edits[field];
  else dna.user_edits[field] = body.value;

  await store.saveDna(user.id, dna); // 같은 버전 덮어쓰기(파일 저장소는 push라 아래에서 처리)
  return Response.json({ dna, effective: applyUserEdits(dna) });
}
