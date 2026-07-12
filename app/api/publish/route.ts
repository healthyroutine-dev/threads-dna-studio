// (선택) 스레드에 바로 발행 — 컨테이너 생성 → 발행 2단계. 목업 모드는 시뮬레이션.
import { NextRequest } from 'next/server';
import { getCurrentUserWithToken, unauthorized } from '@/lib/auth';
import { getStore } from '@/lib/store';
import { publishPost } from '@/lib/threads';

export async function POST(req: NextRequest) {
  const auth = await getCurrentUserWithToken();
  if (!auth) return unauthorized();
  const { user, token } = auth;
  const body = await req.json().catch(() => null);
  const text = body?.text ? String(body.text) : null;
  if (!text?.trim()) return Response.json({ error: '발행할 본문이 없어요.' }, { status: 400 });

  try {
    const result = await publishPost(token.access_token, user.id, text);
    const store = await getStore();
    await store.saveRecord({
      id: `record-${Date.now()}`,
      user_id: user.id,
      text,
      published_at: new Date().toISOString(),
      permalink: result.permalink,
    });
    return Response.json({ ok: true, id: result.id, permalink: result.permalink });
  } catch (e) {
    return Response.json({ error: `발행에 실패했어요: ${e instanceof Error ? e.message : e}` }, { status: 500 });
  }
}
