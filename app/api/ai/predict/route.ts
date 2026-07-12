// 발행 전 예측: {점수, 예상 좋아요 범위, 강점2, 약점2, 개선버전}
import { NextRequest } from 'next/server';
import { getCurrentUser, unauthorized } from '@/lib/auth';
import { aiJson } from '@/lib/ai';
import { applyUserEdits, dnaPromptBlock } from '@/lib/dna';
import { checkAndConsumeQuota, quotaExceeded } from '@/lib/quota';
import { getStore } from '@/lib/store';
import type { Prediction } from '@/lib/types';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => null);
  if (!body?.draftId) return Response.json({ error: 'draftId가 필요해요.' }, { status: 400 });

  const store = await getStore();
  const draft = await store.getDraft(user.id, body.draftId);
  if (!draft) return Response.json({ error: '초안을 찾을 수 없어요.' }, { status: 404 });
  const dna = await store.getLatestDna(user.id);
  if (!dna) return Response.json({ error: '먼저 DNA를 추출해 주세요.' }, { status: 400 });

  const q = await checkAndConsumeQuota(user.id);
  if (!q.ok) return quotaExceeded(q.used, q.limit);

  const [posts, insights] = await Promise.all([store.getPosts(user.id), store.getInsights(user.id)]);
  const likesArr = posts.map((p) => insights[p.id]?.likes ?? 0).filter((n) => n > 0).sort((a, b) => b - a);
  const avg = Math.round(likesArr.reduce((a, b) => a + b, 0) / Math.max(1, likesArr.length));
  const median = likesArr[Math.floor(likesArr.length / 2)] ?? 0;
  const top10Avg = Math.round(likesArr.slice(0, 10).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(10, likesArr.length)));

  const d = applyUserEdits(dna);
  const prediction = await aiJson<Prediction>({
    system:
      '너는 이 계정의 실측 성과 데이터를 아는 스레드(Threads) 성과 예측가다. 초안을 DNA와 실측 수치에 비춰 평가한다. ' +
      '반드시 JSON만 출력: {"score": 0~100 정수, "expected": "예상 좋아요 범위 (예: 400~700개)", ' +
      '"strengths": ["강점 2개"], "weaknesses": ["약점 2개"], "improved": "약점을 보완한 개선 버전 전문 (원문보다 길어지지 않게)"}',
    prompt: `${dnaPromptBlock(dna)}\n\n이 계정의 실측 성과: 평균 좋아요 ${avg}, 중앙값 ${median}, 히트작 TOP10 평균 ${top10Avg}\n\n평가할 초안:\n${draft.text}`,
    maxTokens: 1200,
    mock: () => {
      const t = draft.text;
      let score = 50;
      const strengths: string[] = [];
      const weaknesses: string[] = [];
      if (/\d/.test(t)) { score += 15; strengths.push('구체적 숫자가 들어 있어 신뢰도가 높아요 (이 계정 히트작 공통점)'); }
      else weaknesses.push('숫자가 없어요. 이 계정 히트작 10편 중 9편에 숫자가 있었어요.');
      if (/\n\s*(1\.|1\))/.test(t)) { score += 10; strengths.push('리스트 구조라 저장·재독이 잘 일어나는 폼이에요'); }
      if (/[?？]|해보세요|어떠세요/.test(t)) { score += 10; strengths.push('행동 유도 마무리가 있어 댓글 확률이 높아요'); }
      else weaknesses.push('마무리에 질문·행동 유도가 없어 댓글이 덜 달릴 수 있어요.');
      const lines = t.split('\n').filter((l) => l.trim()).length;
      if (lines > 12) { score -= 10; weaknesses.push(`${lines}줄로 이 계정 평균보다 길어요. 줄이면 완독률이 올라가요.`); }
      if (t.split('\n')[0].length > 40) weaknesses.push('첫 줄(훅)이 길어요. 25자 이내로 끊어 보세요.');
      while (strengths.length < 2) strengths.push('말투가 기존 글과 일관돼 팔로워에게 익숙하게 읽혀요');
      while (weaknesses.length < 2) weaknesses.push('훅에 결과(숫자)를 먼저 보여주면 더 강해질 수 있어요.');
      score = Math.max(20, Math.min(95, score));
      const lo = Math.round((median + (top10Avg - median) * (score / 100)) * 0.6);
      const hi = Math.round((median + (top10Avg - median) * (score / 100)) * 1.3);
      const improvedLines = t.split('\n');
      if (!/[?？]/.test(improvedLines[improvedLines.length - 1] ?? '')) improvedLines.push('', '여러분은 어떠세요?');
      const improved = improvedLines.slice(0, 12).join('\n').trim();
      return { score, expected: `${lo}~${hi}개`, strengths: strengths.slice(0, 2), weaknesses: weaknesses.slice(0, 2), improved };
    },
  });

  draft.prediction = prediction;
  draft.prediction_stale = false;
  draft.improved_applied = false;
  draft.updated_at = new Date().toISOString();
  await store.saveDraft(draft);
  return Response.json({ draft });
}
