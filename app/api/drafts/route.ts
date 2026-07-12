import { NextRequest } from 'next/server';
import { getCurrentUser, unauthorized } from '@/lib/auth';
import { getStore } from '@/lib/store';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const store = await getStore();
  return Response.json({ drafts: await store.getDrafts(user.id) });
}

// 수기 수정·개선안 적용 저장 (본문이 바뀌면 이전 예측은 구버전 처리)
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => null);
  if (!body?.id || typeof body.text !== 'string') {
    return Response.json({ error: 'id와 text가 필요해요.' }, { status: 400 });
  }
  const store = await getStore();
  const draft = await store.getDraft(user.id, body.id);
  if (!draft) return Response.json({ error: '초안을 찾을 수 없어요.' }, { status: 404 });

  const changed = draft.text !== body.text;
  draft.text = body.text;
  if (body.improvedApplied === true) {
    draft.improved_applied = true; // 개선 버전 적용 → "✓ 반영 완료"
    draft.prediction_stale = false;
  } else if (changed && draft.prediction) {
    draft.prediction_stale = true; // 수기 수정 → 이전 예측 "구버전"
    draft.improved_applied = false;
  }
  draft.updated_at = new Date().toISOString();
  await store.saveDraft(draft);
  return Response.json({ draft });
}
