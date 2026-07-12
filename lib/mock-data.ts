// 목업 모드용 데이터 — 시드 고정 PRNG로 항상 같은 결과가 나오게 생성
import type { Insight, Post } from './types';

export const MOCK_USER = {
  id: 'mock-1',
  threads_user_id: 'mock-1',
  username: 'rework_studio99',
  name: '리워크 스튜디오',
  bio: '스레드로 퍼스널 브랜딩하는 법을 기록합니다. 스치니들과 함께 성장 중 🌱',
};

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// [본문, 품질(0~1) — 히트작/부진작 분포용]
const TEMPLATES: Array<[string, number]> = [
  ['스치니들, 팔로워 0명에서 1000명까지 제가 한 건 딱 3가지예요.\n\n1. 매일 같은 시간에 올리기\n2. 댓글에 무조건 답하기\n3. 한 주제만 파기\n\n특별한 비법은 없었어요. 그냥 안 그만뒀을 뿐.', 0.95],
  ['글 안 읽히는 이유, 첫 줄에서 다 갈립니다.\n\n"오늘 카페에 갔다" ❌\n"카페에서 옆 테이블 대화 듣다가 사업 아이템 얻음" ⭕\n\n첫 줄은 요약이 아니라 미끼예요.', 0.92],
  ['스레드 3개월 하고 깨달은 것.\n\n잘 쓴 글보다 자주 쓴 글이 이깁니다.\n완벽한 글 일주일에 1개보다\n어설픈 글 매일 1개가 계정을 키워요.', 0.9],
  ['스치니들 저 오늘 팔로워 2000 됐어요 🥹\n\n7개월 걸렸습니다.\n중간에 3번 접을 뻔했어요.\n\n버틴 게 실력이 되는 곳이 여기더라고요.', 0.88],
  ['댓글 많이 받는 글의 공통점 하나.\n\n마지막 줄이 질문이에요.\n\n"여러분은 어떠세요?"만 붙여도 댓글이 2배가 됩니다.\n오늘 글부터 바로 해보세요.', 0.85],
  ['인풋 없이 아웃풋만 뽑으니까 글이 안 써지는 거예요.\n\n하루 30분 독서 → 글감 3개\n하루 0분 독서 → 글감 0개\n\n제 경험상 이 공식은 한 번도 틀린 적 없어요.', 0.8],
  ['퍼스널 브랜딩 어렵게 생각하지 마세요.\n\n"내가 아는 걸 모르는 사람에게 알려주기"\n\n이게 전부입니다. 전문가일 필요 없어요. 반 발짝만 앞서 있으면 돼요.', 0.78],
  ['글감 떨어졌을 때 제가 쓰는 방법.\n\n오늘 나눈 대화 중에 "아 그거 몰랐어?"라는 말이 나온 순간을 찾아요.\n그게 바로 글감입니다.', 0.72],
  ['새벽 5시 기상 3주차 후기.\n\n솔직히 말하면 저녁형 인간은 굳이 안 바꿔도 됩니다.\n중요한 건 기상 시간이 아니라 확보한 시간에 뭘 하느냐더라고요.', 0.65],
  ['오늘의 작업 브금 공유해요.\n로파이 힙합 틀어놓고 글 쓰면 집중이 잘 되더라고요 🎧', 0.2],
  ['비 오는 날엔 역시 따뜻한 아메리카노죠 ☕\n다들 좋은 하루 보내세요!', 0.1],
  ['요즘 읽고 있는 책이에요. 다 읽으면 후기 남길게요 📚', 0.15],
  ['스레드 알고리즘 바뀐 것 같지 않나요?\n요즘 도달이 좀 이상하네요…', 0.3],
  ['주말에도 글 올리는 게 맞을까요, 쉬는 게 맞을까요?\n저는 매일 올리는 편인데 가끔 헷갈려요.', 0.35],
  ['작업실 정리했어요! 환경이 바뀌니까 기분도 새롭네요 ✨', 0.12],
  ['1일 1포스팅 100일 채웠습니다.\n\n달라진 것: 팔로워 +1400, 글 쓰는 속도 3배, 그리고 무엇보다 "쓸 게 없다"는 말이 사라졌어요.\n\n양이 질을 만듭니다.', 0.93],
  ['팔로워 늘리려고 맞팔 이벤트 하지 마세요.\n\n숫자는 늘어도 도달은 떨어집니다.\n내 글에 반응 없는 팔로워 1000명보다 반응하는 100명이 계정을 키워요.', 0.87],
  ['글 쓰기 전에 딱 한 가지만 정하세요.\n\n"이 글을 읽고 독자가 뭘 하길 바라는가?"\n\n저장? 댓글? 팔로우?\n목적 없는 글은 그냥 일기예요.', 0.82],
  ['오늘 점심은 김치찌개였습니다 🍲\n오후도 화이팅!', 0.08],
  ['제 프로필 소개글 바꿨는데 어떤가요?\n피드백 환영합니다 🙏', 0.25],
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function generateMockPosts(userId: string, now = new Date()): { posts: Post[]; insights: Insight[] } {
  const rand = mulberry32(20260707);
  const posts: Post[] = [];
  const insights: Insight[] = [];
  const COUNT = 60;
  for (let i = 0; i < COUNT; i++) {
    const [text, quality] = TEMPLATES[i % TEMPLATES.length];
    // 최근 120일에 걸쳐 분포 (i=0이 가장 최신)
    const daysAgo = Math.floor((i / COUNT) * 120) + Math.floor(rand() * 2);
    const d = new Date(now.getTime() - daysAgo * 86400_000 - Math.floor(rand() * 43200_000));
    const suffix = i >= TEMPLATES.length ? `\n\n(Day ${100 - i})` : '';
    const id = `mock-post-${pad(i)}`;
    posts.push({
      id,
      user_id: userId,
      text: text + suffix,
      timestamp: d.toISOString(),
      media_type: 'TEXT_POST',
      permalink: `https://www.threads.net/@${MOCK_USER.username}/post/${id}`,
    });
    const views = Math.round(400 + quality * 18000 + rand() * 1500);
    const likes = Math.round(views * (0.02 + quality * 0.05) * (0.8 + rand() * 0.4));
    insights.push({
      post_id: id,
      views,
      likes,
      replies: Math.round(likes * (0.1 + rand() * 0.25)),
      reposts: Math.round(likes * 0.08 * rand()),
      quotes: Math.round(likes * 0.04 * rand()),
      fetched_at: now.toISOString(),
    });
  }
  return { posts, insights };
}

// 팔로워 수: 날짜가 지날수록 완만히 증가하는 결정적 곡선
export function mockFollowersOn(date: Date): number {
  const epochDays = Math.floor(date.getTime() / 86400_000);
  const start = 20500; // 기준일
  const wave = Math.sin(epochDays / 5) * 6;
  return Math.round(2000 + Math.max(0, epochDays - start) * 3.2 + wave);
}

export function mockAccountViewsOn(date: Date): number {
  const epochDays = Math.floor(date.getTime() / 86400_000);
  return 3000 + ((epochDays * 31) % 2200);
}
