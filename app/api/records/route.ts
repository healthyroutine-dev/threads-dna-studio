import { NextRequest } from 'next/server';
import { getCurrentUser, unauthorized } from '@/lib/auth';
import { getStore } from '@/lib/store';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const store = await getStore();
  return Response.json({ records: await store.getRecords(user.id) });
}

// 발행 완료 → 기록
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => null);
  if (!body?.text) return Response.json({ error: 'text가 필요해요.' }, { status: 400 });
  const store = await getStore();
  const record = {
    id: `record-${Date.now()}`,
    user_id: user.id,
    text: String(body.text),
    published_at: new Date().toISOString(),
    permalink: body.permalink ? String(body.permalink) : undefined,
  };
  await store.saveRecord(record);
  return Response.json({ record });
}
