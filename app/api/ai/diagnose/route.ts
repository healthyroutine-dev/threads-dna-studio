import { getCurrentUser, unauthorized } from '@/lib/auth';
import { aiJson } from '@/lib/ai';
import { checkAndConsumeQuota, quotaExceeded } from '@/lib/quota';
import { getStore } from '@/lib/store';

interface Diagnosis {
  diagnosis: string;
  next_actions: string[];
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const q = await checkAndConsumeQuota(user.id);
  if (!q.ok) return quotaExceeded(q.used, q.limit);

  const store = await getStore();
  const [snapshots, posts, insights, dna] = await Promise.all([
    store.getSnapshots(user.id),
    store.getPosts(user.id),
    store.getInsights(user.id),
    store.getLatestDna(user.id),
  ]);

  const recent = posts.slice(0, 10).map((p) => ({
    text: p.text.slice(0, 100),
    likes: insights[p.id]?.likes ?? null,
    views: insights[p.id]?.views ?? null,
    date: p.timestamp.slice(0, 10),
  }));
  const history = snapshots.slice(-30).map((s) => `${s.date}: ${s.followers_count}명`);

  const result = await aiJson<Diagnosis>({
    system:
      '너는 스레드(Threads) 계정 성장 코치다. 팔로워 히스토리와 최근 글 성과를 보고 한국어로 진단한다. ' +
      '반드시 JSON만 출력: {"diagnosis": "현재 상태 진단 2~3문장", "next_actions": ["이번 주에 할 구체적 액션 3개"]}',
    prompt: `팔로워 히스토리(최근 30일):\n${history.join('\n') || '데이터 없음'}\n\n최근 글 10개 성과:\n${JSON.stringify(recent, null, 2)}\n\n${dna ? `이 사람의 콘텐츠 DNA 요약: 잘되는 축 ${JSON.stringify(dna.winning_axes.map((a) => a.axis))}, 약점: ${dna.weakness}` : ''}`,
    mock: () => {
      const first = snapshots[0]?.followers_count ?? 0;
      const last = snapshots[snapshots.length - 1]?.followers_count ?? 0;
      const gain = last - first;
      return {
        diagnosis: `최근 30일간 팔로워가 ${gain >= 0 ? `+${gain}` : gain}명 변화했어요. 경험담+구체적 숫자가 들어간 글이 평균 대비 3배 높은 반응을 얻고 있고, 일상 공유형 글은 도달이 낮은 편이에요. 성장 곡선은 완만한 우상향으로 건강한 상태입니다.`,
        next_actions: [
          '이번 주 히트작 유형(숫자+경험담) 글을 3편 이상 발행하기',
          '반응이 낮은 일상 공유형 글은 주 1회 이하로 줄이기',
          '댓글이 많이 달린 글의 질문형 마무리를 모든 글에 적용해 보기',
        ],
      };
    },
  });

  return Response.json(result);
}
