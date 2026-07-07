// 동기화 1배치 처리 — 클라이언트가 done/error가 될 때까지 반복 호출한다.
// (서버리스에서 백그라운드 잡 대신 쓰는 방식: 진행률·이어하기가 자연스럽게 지원됨)
import { NextRequest } from 'next/server';
import { getCurrentUserWithToken, unauthorized } from '@/lib/auth';
import { getStore } from '@/lib/store';
import { fetchPostInsights, fetchPostsPage } from '@/lib/threads';
import type { SyncState } from '@/lib/types';

const INSIGHT_BATCH = 25; // 레이트리밋(시간당 ~200콜) 고려한 배치 크기
const MODES = ['all', 'posts', 'recent', 'insights'] as const;

export async function POST(req: NextRequest) {
  const auth = await getCurrentUserWithToken();
  if (!auth) return unauthorized();
  const { user, token } = auth;
  const store = await getStore();

  const body = await req.json().catch(() => ({}));
  const mode = MODES.includes(body.mode) ? (body.mode as SyncState['mode']) : 'all';
  const restart = body.restart === true;

  let state = await store.getSyncState(user.id);
  // 새 동기화 시작 (실행 중이 아니거나, 모드가 다르거나, 명시적 재시작)
  if (!state || state.status !== 'running' || state.mode !== mode || restart) {
    state = {
      user_id: user.id,
      mode,
      status: 'running',
      phase: mode === 'insights' ? 'insights' : 'posts',
      total: 0,
      done: 0,
      cursor: null,
      insight_offset: 0,
      updated_at: new Date().toISOString(),
    };
    if (mode === 'insights') {
      const posts = await store.getPosts(user.id);
      state.total = posts.length;
    }
  }

  try {
    if (state.phase === 'posts') {
      // recent 모드: 저장된 가장 최신 글 이후만
      let since: string | undefined;
      if (mode === 'recent' && !state.cursor) {
        const existing = await store.getPosts(user.id);
        since = existing[0]?.timestamp;
      }
      const page = await fetchPostsPage(token.access_token, user.id, state.cursor, since);
      await store.upsertPosts(page.posts);
      state.done += page.posts.length;
      state.cursor = page.nextCursor;
      state.message = `글 ${state.done}개 수집`;

      if (!page.nextCursor) {
        if (mode === 'posts') {
          state.status = 'done';
          state.phase = 'done';
        } else {
          // 통계 단계로 전환: 최신순 배치
          const posts = await store.getPosts(user.id);
          state.phase = 'insights';
          state.total = mode === 'recent' ? Math.min(state.done, posts.length) : posts.length;
          state.done = 0;
          state.insight_offset = 0;
        }
      }
    } else if (state.phase === 'insights') {
      const posts = await store.getPosts(user.id); // 최신순
      const targets = posts.slice(state.insight_offset, state.insight_offset + INSIGHT_BATCH).slice(0, state.total - state.insight_offset);
      const results = [];
      for (const p of targets) {
        results.push(await fetchPostInsights(token.access_token, p.id));
      }
      await store.saveInsights(results);
      state.insight_offset += targets.length;
      state.done = state.insight_offset;
      state.message = `통계 ${state.done}/${state.total}개 수집`;
      if (state.insight_offset >= state.total || targets.length === 0) {
        state.status = 'done';
        state.phase = 'done';
      }
    }
  } catch (e) {
    state.status = 'error';
    state.message = e instanceof Error ? e.message : String(e);
  }

  state.updated_at = new Date().toISOString();
  await store.saveSyncState(state);
  return Response.json({ state });
}
