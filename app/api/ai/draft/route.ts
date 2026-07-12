// 글감 → 초안 (본문만, 유저 길이 습관 반영하되 기본 짧게)
import { NextRequest } from 'next/server';
import { getCurrentUser, unauthorized } from '@/lib/auth';
import { aiText } from '@/lib/ai';
import { applyUserEdits, dnaPromptBlock } from '@/lib/dna';
import { checkAndConsumeQuota, quotaExceeded } from '@/lib/quota';
import { getStore } from '@/lib/store';
import type { Draft } from '@/lib/types';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => null);
  if (!body?.topic) return Response.json({ error: '글감(topic)이 필요해요.' }, { status: 400 });

  const store = await getStore();
  const dna = await store.getLatestDna(user.id);
  if (!dna) return Response.json({ error: '먼저 DNA 탭에서 DNA를 추출해 주세요.' }, { status: 400 });

  const q = await checkAndConsumeQuota(user.id);
  if (!q.ok) return quotaExceeded(q.used, q.limit);

  const d = applyUserEdits(dna);
  const text = await aiText({
    system:
      '너는 이 사람 본인처럼 스레드(Threads) 글을 쓰는 대필가다. 아래 DNA의 말투 규칙과 스타일 예시를 그대로 따라라. ' +
      '조건: 본문만 출력(제목·해설·따옴표 금지), 10줄 이내로 짧게, 첫 줄은 훅, 이 사람의 행갈이 습관 유지.',
    prompt: `${dnaPromptBlock(dna)}\n\n글감: ${body.topic}\n${body.axis ? `사용할 축: ${body.axis}` : ''}\n${body.direction ? `전개 방향: ${body.direction}` : ''}\n\n이 글감으로 스레드 글 초안을 써라.`,
    maxTokens: 800,
    mock: () => {
      const hook = d.signature_hook.includes('○○')
        ? `스치니들, ${body.topic} — 오늘 제 경험 그대로 공유해요.`
        : `${body.topic}, 오늘 하나만 기억하세요.`;
      return [
        hook,
        '',
        '저도 처음엔 감으로만 했었어요.',
        '그런데 숫자를 기록하기 시작하니까 달라지더라고요.',
        '',
        '1. 어제보다 딱 1%만 다르게 해보기',
        '2. 반응이 온 지점을 메모로 남기기',
        '3. 일주일에 한 번 기록 돌아보기',
        '',
        '거창한 전략보다 이 세 개가 계정을 키웠어요.',
        '여러분은 어떠세요?',
      ].join('\n');
    },
  });

  const now = new Date().toISOString();
  const draft: Draft = {
    id: `draft-${Date.now()}`,
    user_id: user.id,
    topic: body.topic,
    axis: body.axis ?? '',
    text,
    prediction: null,
    prediction_stale: false,
    improved_applied: false,
    created_at: now,
    updated_at: now,
  };
  await store.saveDraft(draft);
  return Response.json({ draft });
}
