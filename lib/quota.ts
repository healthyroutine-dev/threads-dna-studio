// 유저별 일일 AI 호출 한도 (비용 가드) — 모든 AI 라우트가 호출 전 확인
import { aiDailyLimit } from './env';
import { getStore } from './store';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function checkAndConsumeQuota(userId: string): Promise<{ ok: boolean; used: number; limit: number }> {
  const store = await getStore();
  const limit = aiDailyLimit();
  const usage = await store.getAiUsage(userId, today());
  if (usage.count >= limit) return { ok: false, used: usage.count, limit };
  const used = await store.incrAiUsage(userId, today());
  return { ok: true, used, limit };
}

export function quotaExceeded(used: number, limit: number) {
  return Response.json(
    { error: `오늘의 AI 호출 한도(${limit}회)를 모두 사용했어요. 내일 다시 시도해 주세요.`, used, limit },
    { status: 429 }
  );
}
