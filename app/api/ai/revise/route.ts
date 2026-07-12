// 자연어 수정 요청 → 요청 부분만 고친 전체 본문
import { NextRequest } from 'next/server';
import { getCurrentUser, unauthorized } from '@/lib/auth';
import { aiText } from '@/lib/ai';
import { dnaPromptBlock } from '@/lib/dna';
import { checkAndConsumeQuota, quotaExceeded } from '@/lib/quota';
import { getStore } from '@/lib/store';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => null);
  if (!body?.draftId || !body?.request) {
    return Response.json({ error: 'draftId와 수정 요청(request)이 필요해요.' }, { status: 400 });
  }

  const store = await getStore();
  const draft = await store.getDraft(user.id, body.draftId);
  if (!draft) return Response.json({ error: '초안을 찾을 수 없어요.' }, { status: 404 });
  const dna = await store.getLatestDna(user.id);

  const q = await checkAndConsumeQuota(user.id);
  if (!q.ok) return quotaExceeded(q.used, q.limit);

  const text = await aiText({
    system:
      '너는 이 사람 본인처럼 스레드(Threads) 글을 다듬는 편집자다. 사용자의 수정 요청에 해당하는 부분만 고치고 나머지는 그대로 둔다. ' +
      '말투 규칙 유지, 본문 전체만 출력(해설 금지).',
    prompt: `${dna ? dnaPromptBlock(dna) + '\n\n' : ''}현재 초안:\n${draft.text}\n\n수정 요청: ${body.request}\n\n요청 부분만 수정한 전체 본문을 출력해라.`,
    maxTokens: 800,
    mock: () => {
      const lines = draft.text.split('\n');
      const r = String(body.request);
      if (/짧/.test(r)) return lines.filter((l, i) => i < 6 || l.trim() === '').slice(0, 6).join('\n').trim();
      if (/훅|첫\s?줄/.test(r)) return ['스치니들, 이거 하나로 결과가 달라졌어요.', ...lines.slice(1)].join('\n');
      if (/질문/.test(r)) return [...lines.filter((l) => l.trim() !== '여러분은 어떠세요?'), '', '여러분은 어떻게 하고 계세요?'].join('\n').trim();
      if (/이모지/.test(r)) return draft.text.replace(/\s*🌱|✨|☕|🎧|📚/g, '') + ' 🌱';
      // 기본: 어미를 조금 더 단정하게
      return draft.text.replace(/했었어요\./g, '했어요.').replace(/더라고요\./g, '더라고요. 진짜예요.');
    },
  });

  draft.text = text;
  draft.prediction_stale = draft.prediction !== null; // 이전 예측은 구버전
  draft.improved_applied = false;
  draft.updated_at = new Date().toISOString();
  await store.saveDraft(draft);
  return Response.json({ draft });
}
