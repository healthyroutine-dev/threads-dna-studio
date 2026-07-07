// ★ DNA 추출 파이프라인 (설계문서 6장)
// 전처리(상위10/하위10/중간5 샘플링) → AI 1차 말투 분석 → AI 2차 폼 분석 → 스타일 앵커 → 버전 저장
import { aiJson } from './ai';
import type { Dna, Insight, Post, User, WinningAxis } from './types';

export const MIN_POSTS = 15;

interface ScoredPost {
  post: Post;
  likes: number;
  views: number;
  replies: number;
}

function scorePosts(posts: Post[], insights: Record<string, Insight>): ScoredPost[] {
  return posts
    .filter((p) => p.text.trim().length > 0)
    .map((p) => ({
      post: p,
      likes: insights[p.id]?.likes ?? 0,
      views: insights[p.id]?.views ?? 0,
      replies: insights[p.id]?.replies ?? 0,
    }))
    .sort((a, b) => b.likes - a.likes || b.views - a.views);
}

export function sampleForExtraction(scored: ScoredPost[]) {
  const top = scored.slice(0, 10);
  const bottom = scored.slice(-10);
  const middlePool = scored.slice(10, Math.max(10, scored.length - 10));
  const middle: ScoredPost[] = [];
  const step = Math.max(1, Math.floor(middlePool.length / 5));
  for (let i = 0; i < middlePool.length && middle.length < 5; i += step) middle.push(middlePool[i]);
  return { top, bottom, middle };
}

function fmt(list: ScoredPost[]): string {
  return list
    .map((s, i) => `--- 글 ${i + 1} (좋아요 ${s.likes}, 조회 ${s.views}, 댓글 ${s.replies}) ---\n${s.post.text}`)
    .join('\n\n');
}

// ── 목업 분석: 실제 글 통계에서 계산해 그럴듯한 결과를 만든다 ──
function mockToneRules(scored: ScoredPost[]): string[] {
  const texts = scored.map((s) => s.post.text);
  const avgLines = Math.round(texts.reduce((a, t) => a + t.split('\n').length, 0) / Math.max(1, texts.length));
  const avgLen = Math.round(texts.reduce((a, t) => a + t.length, 0) / Math.max(1, texts.length));
  const emojiCount = texts.filter((t) => /\p{Extended_Pictographic}/u.test(t)).length;
  const emojiRatio = Math.round((emojiCount / Math.max(1, texts.length)) * 100);
  const rules = [
    `평균 ${avgLines}줄, ${avgLen}자 내외로 짧게 끊어 쓴다`,
    '한 문장이 끝나면 행갈이로 호흡을 준다 (한 줄에 한 생각)',
    '"~예요/~더라고요" 부드러운 존댓말 어미를 쓴다',
    '독자를 "스치니들"이라고 부르며 시작하는 글이 많다',
    `이모지는 글의 ${emojiRatio}%에서만, 마지막 줄에 1개 정도로 절제해서 쓴다`,
    '숫자를 그대로 노출한다 (예: "0명에서 1000명", "3가지")',
    '마지막 줄은 짧은 단정문 또는 질문으로 끝낸다',
  ];
  return rules;
}

function mockFormAnalysis(top: ScoredPost[], bottom: ScoredPost[]) {
  const avgTop = Math.round(top.reduce((a, s) => a + s.likes, 0) / Math.max(1, top.length));
  const avgBottom = Math.round(bottom.reduce((a, s) => a + s.likes, 0) / Math.max(1, bottom.length));
  const ratio = avgBottom > 0 ? (avgTop / avgBottom).toFixed(1) : '10+';
  const listCount = top.filter((s) => /\n\s*(1\.|1\))/.test(s.post.text)).length;
  const questionEnd = top.filter((s) => s.post.text.trim().endsWith('?') || /해보세요|어떠세요/.test(s.post.text)).length;
  return {
    winning_axes: [
      {
        axis: '숫자가 든 경험담',
        evidence: `히트작 TOP10 평균 좋아요 ${avgTop}개 — 부진작 평균(${avgBottom}개)의 ${ratio}배. TOP10 중 ${top.filter((s) => /\d/.test(s.post.text)).length}편에 구체적 숫자 포함`,
        tip: '"팔로워 0→1000", "3개월", "딱 3가지"처럼 숫자를 첫 줄에 박아라',
      },
      {
        axis: '리스트형 정리',
        evidence: `히트작 TOP10 중 ${listCount}편이 번호 리스트 구조`,
        tip: '팁이 2개 이상이면 무조건 1. 2. 3. 으로 쪼개라',
      },
      {
        axis: '행동 유도 마무리',
        evidence: `TOP10 중 ${questionEnd}편이 질문·권유형 마무리 ("오늘 글부터 바로 해보세요")`,
        tip: '마지막 줄에 독자가 오늘 할 수 있는 행동 하나를 남겨라',
      },
    ] as WinningAxis[],
    weakness: '일상 공유형 글(카페·점심·브금)은 평균 대비 반응이 크게 낮다. 근황도 배움·숫자와 엮어야 도달이 나온다.',
    signature_hook: '스치니들, ○○에서 ○○까지 제가 한 건 딱 N가지예요.',
  };
}

// 데이터 부족 모드: 톤 질문 3개 답변으로 임시 DNA 생성
export interface ToneAnswers {
  tone: string; // 예: 부드러운 존댓말 / 단호한 반말
  emoji: string; // 예: 절제해서 / 자주
  topic: string; // 주 주제
}

export function provisionalDna(user: User, answers: ToneAnswers, postCount: number, prevVersion: number): Dna {
  return {
    version: prevVersion + 1,
    extracted_at: new Date().toISOString(),
    post_count_analyzed: postCount,
    identity: `${answers.topic}에 대해 이야기하는 @${user.username}. ${user.bio ?? ''}`.trim(),
    tone_rules: [
      `${answers.tone} 말투를 쓴다`,
      `이모지는 ${answers.emoji} 쓴다`,
      '한 문장마다 행갈이로 호흡을 준다',
      '글은 10줄 이내로 짧게 쓴다',
    ],
    signature_hook: `${answers.topic} 이야기, 오늘은 하나만 기억하세요.`,
    winning_axes: [
      {
        axis: answers.topic,
        evidence: `아직 글이 ${postCount}개뿐이라 실측 근거가 없어요. 글이 15개 이상 쌓이면 자동으로 정식 DNA로 승격됩니다.`,
        tip: '일단 꾸준히 발행하며 데이터를 쌓아 보세요',
      },
    ],
    weakness: '데이터 부족 — 글이 쌓이면 약점도 실측으로 분석됩니다.',
    style_anchors: [],
    user_edits: {},
    provisional: true,
  };
}

export async function extractDna(user: User, posts: Post[], insights: Record<string, Insight>, prev: Dna | null): Promise<Dna> {
  const scored = scorePosts(posts, insights);
  const { top, bottom, middle } = sampleForExtraction(scored);

  // AI 1차 — 말투 분석
  const tone = await aiJson<{ tone_rules: string[] }>({
    system:
      '너는 한국어 SNS 글쓰기 스타일 분석가다. 아래 스레드(Threads) 글들을 보고 이 사람의 말투 규칙을 추출한다. ' +
      '어미 패턴, 행갈이 습관, 문장부호, 이모지 빈도, 고정 호칭(예: 스치니), 글 길이 분포를 근거로 6~10개의 규칙을 만든다. ' +
      '다른 사람이 이 규칙만 보고 흉내 낼 수 있을 만큼 구체적으로. 반드시 JSON만 출력: {"tone_rules": ["...", ...]}',
    prompt: `히트작:\n${fmt(top)}\n\n중간 성과 글:\n${fmt(middle)}\n\n부진작:\n${fmt(bottom)}`,
    maxTokens: 1500,
    mock: () => ({ tone_rules: mockToneRules(scored) }),
  });

  // AI 2차 — 폼 분석 (잘되는 축 + 약점 + 시그니처 훅)
  const form = await aiJson<{ winning_axes: WinningAxis[]; weakness: string; signature_hook: string; identity: string }>({
    system:
      '너는 한국어 SNS 콘텐츠 전략가다. 히트작과 부진작을 비교해 이 계정의 성공 공식을 추출한다. 반드시 JSON만 출력:\n' +
      '{"identity": "이 사람이 어떤 사람이고 무엇을 말하는 계정인지 한 문단", ' +
      '"winning_axes": [{"axis": "잘되는 축 이름", "evidence": "실측 수치 근거 (좋아요/조회수 비교)", "tip": "이 축을 쓸 때의 팁"}] (최대 3개), ' +
      '"weakness": "부진작의 공통점에서 찾은 약점 1~2문장", ' +
      '"signature_hook": "히트작 첫 줄들의 공통 패턴을 템플릿화한 시그니처 훅 문구"}',
    prompt: `계정 소개: ${user.bio ?? '(없음)'} (@${user.username})\n\n히트작 TOP10 (좋아요·조회수 포함):\n${fmt(top)}\n\n부진작 10개:\n${fmt(bottom)}`,
    maxTokens: 1800,
    mock: () => ({
      identity: `스레드로 퍼스널 브랜딩과 계정 성장 노하우를 나누는 @${user.username}. 자신의 실험과 숫자를 근거로 "꾸준함이 실력"이라는 메시지를 전하며, 팔로워를 "스치니들"이라 부르는 친근한 성장 기록 계정.`,
      ...mockFormAnalysis(top, bottom),
    }),
  });

  // 스타일 앵커: 히트작 중 본문이 온전한 글 2~3편
  const anchors = top
    .filter((s) => s.post.text.length >= 50)
    .slice(0, 3)
    .map((s) => s.post.text);

  return {
    version: (prev?.version ?? 0) + 1,
    extracted_at: new Date().toISOString(),
    post_count_analyzed: scored.length,
    identity: form.identity,
    tone_rules: tone.tone_rules,
    signature_hook: form.signature_hook,
    winning_axes: form.winning_axes.slice(0, 3),
    weakness: form.weakness,
    style_anchors: anchors,
    user_edits: prev?.user_edits ?? {}, // 사용자 수정은 재추출해도 보존
  };
}

// 사용자 수정(user_edits)을 자동 추출값 위에 덮어쓴 "적용본"
export function applyUserEdits(dna: Dna): Dna {
  const e = dna.user_edits ?? {};
  return {
    ...dna,
    identity: (e.identity as string) ?? dna.identity,
    tone_rules: (e.tone_rules as string[]) ?? dna.tone_rules,
    signature_hook: (e.signature_hook as string) ?? dna.signature_hook,
    winning_axes: (e.winning_axes as WinningAxis[]) ?? dna.winning_axes,
    weakness: (e.weakness as string) ?? dna.weakness,
    style_anchors: (e.style_anchors as string[]) ?? dna.style_anchors,
  };
}

// AI 라우트에 주입할 DNA 프롬프트 블록
export function dnaPromptBlock(dna: Dna): string {
  const d = applyUserEdits(dna);
  return [
    `[이 사람의 콘텐츠 DNA]`,
    `정체성: ${d.identity}`,
    `말투 규칙:\n${d.tone_rules.map((r) => `- ${r}`).join('\n')}`,
    `시그니처 훅: ${d.signature_hook}`,
    `잘되는 축:\n${d.winning_axes.map((a) => `- ${a.axis} (근거: ${a.evidence}) 팁: ${a.tip}`).join('\n')}`,
    `약점: ${d.weakness}`,
    d.style_anchors.length ? `스타일 예시(이 사람이 실제로 쓴 히트작):\n${d.style_anchors.map((a, i) => `예시 ${i + 1}:\n${a}`).join('\n\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}
