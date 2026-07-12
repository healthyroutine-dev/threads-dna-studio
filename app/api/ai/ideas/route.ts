// 글감 5개 생성 — DNA + 최근 성과 주입, 최근 주제 중복 금지, 축 고루
import { getCurrentUser, unauthorized } from '@/lib/auth';
import { aiJson } from '@/lib/ai';
import { applyUserEdits, dnaPromptBlock } from '@/lib/dna';
import { checkAndConsumeQuota, quotaExceeded } from '@/lib/quota';
import { getStore } from '@/lib/store';
import type { Idea } from '@/lib/types';

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const store = await getStore();
  const dna = await store.getLatestDna(user.id);
  if (!dna) return Response.json({ error: '먼저 DNA 탭에서 DNA를 추출해 주세요.' }, { status: 400 });

  const q = await checkAndConsumeQuota(user.id);
  if (!q.ok) return quotaExceeded(q.used, q.limit);

  const [posts, insights, recentIdeas] = await Promise.all([
    store.getPosts(user.id),
    store.getInsights(user.id),
    store.getRecentIdeas(user.id, 15),
  ]);
  const recentPerf = posts.slice(0, 8).map((p) => ({
    topic: p.text.split('\n')[0].slice(0, 50),
    likes: insights[p.id]?.likes ?? null,
  }));
  const d = applyUserEdits(dna);

  const result = await aiJson<{ ideas: Array<{ topic: string; axis: string; direction: string }> }>({
    system:
      '너는 스레드(Threads) 콘텐츠 기획자다. 이 사람의 DNA와 최근 성과를 보고 오늘 쓸 글감 5개를 제안한다. ' +
      '조건: (1) 최근 다룬 주제와 겹치지 않게 (2) 잘되는 축들을 고루 사용 (3) direction은 첫 줄을 어떻게 시작할지까지 구체적으로. ' +
      '반드시 JSON만 출력: {"ideas": [{"topic": "글감 한 줄", "axis": "사용한 잘되는 축 이름", "direction": "전개 방향 1~2문장"}]} 5개.',
    prompt: `${dnaPromptBlock(dna)}\n\n최근 글 주제와 성과:\n${JSON.stringify(recentPerf, null, 2)}\n\n최근 이미 제안한 글감(중복 금지):\n${recentIdeas.map((i) => `- ${i.topic}`).join('\n') || '없음'}`,
    maxTokens: 1500,
    mock: () => {
      const axes = d.winning_axes.map((a) => a.axis);
      const ax = (i: number) => axes[i % Math.max(1, axes.length)] ?? '경험담';
      const seed = recentIdeas.length; // 재생성 시 다른 글감이 나오게
      const pool = [
        { topic: '내가 스레드에서 지운 글 유형 3가지', direction: '"이 글들 지우고 나서 도달이 올랐어요"로 시작해 실패 사례를 숫자와 함께 공개' },
        { topic: '팔로워 100명일 때 알았으면 좋았을 것들', direction: '과거의 나에게 보내는 편지 형식, 구체적 시행착오 3가지 리스트' },
        { topic: '글 하나 쓰는 데 걸리는 시간, 15분으로 줄인 방법', direction: '"예전엔 2시간, 지금은 15분" 대비 훅으로 시작해 프로세스 공개' },
        { topic: '댓글 0개였던 글을 살려낸 재발행 실험', direction: '같은 글을 훅만 바꿔 다시 올린 실측 결과 비교' },
        { topic: '스레드 번아웃 왔을 때 계정 안 죽이는 법', direction: '약점(꾸준함 부담)을 정면으로 다루되 유지 전략 3가지로 마무리' },
        { topic: '저장 많이 되는 글의 공통 구조 해부', direction: '내 히트작 3편의 구조를 분해해 템플릿으로 정리' },
        { topic: '한 달간 매일 쓴 사람의 지표 변화 공개', direction: '팔로워·조회수 전후 숫자를 표처럼 나열하고 결론 한 줄' },
        { topic: '알고리즘 탓하기 전에 확인할 체크리스트 4개', direction: '"도달 떨어졌다면 알고리즘보다 이것부터"로 시작하는 번호 리스트' },
        { topic: 'DM으로 가장 많이 받는 질문에 공개 답변', direction: '질문 인용 → 답변 → "여러분은 어떠세요?" 질문 마무리' },
        { topic: '팔로우 누르게 만드는 프로필 소개글 공식', direction: '내 소개글 Before/After와 변화 수치 공개' },
      ];
      const ideas = Array.from({ length: 5 }, (_, i) => {
        const p = pool[(seed + i) % pool.length];
        return { topic: p.topic, axis: ax(i), direction: p.direction };
      });
      return { ideas };
    },
  });

  const now = new Date().toISOString();
  const ideas: Idea[] = result.ideas.slice(0, 5).map((i, idx) => ({
    id: `idea-${Date.now()}-${idx}`,
    user_id: user.id,
    topic: i.topic,
    axis: i.axis,
    direction: i.direction,
    created_at: now,
  }));
  await store.saveIdeas(ideas);
  return Response.json({ ideas });
}
