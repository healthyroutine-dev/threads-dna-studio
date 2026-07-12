// Threads API 클라이언트 — 환경변수가 없으면 목업으로 동작
import { isMockThreads } from './env';
import { MOCK_USER, generateMockPosts, mockAccountViewsOn, mockFollowersOn } from './mock-data';
import type { Insight, Post } from './types';

const GRAPH = 'https://graph.threads.net';
export const SCOPES = 'threads_basic,threads_manage_insights,threads_content_publish';

export interface ThreadsProfile {
  id: string;
  username: string;
  name?: string;
  biography?: string;
}

async function api<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Threads API ${path} 실패 (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json();
}

export function getAuthUrl(state: string): string {
  const url = new URL('https://threads.net/oauth/authorize');
  url.searchParams.set('client_id', process.env.THREADS_APP_ID!);
  url.searchParams.set('redirect_uri', process.env.THREADS_REDIRECT_URI!);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  return url.toString();
}

// code → 단기 토큰 → th_exchange 60일 장기 토큰
export async function exchangeCode(code: string): Promise<{ accessToken: string; userId: string; expiresAt: string }> {
  const shortRes = await fetch(`${GRAPH}/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.THREADS_APP_ID!,
      client_secret: process.env.THREADS_APP_SECRET!,
      grant_type: 'authorization_code',
      redirect_uri: process.env.THREADS_REDIRECT_URI!,
      code,
    }),
  });
  if (!shortRes.ok) throw new Error(`토큰 교환 실패 (${shortRes.status}): ${(await shortRes.text()).slice(0, 300)}`);
  const short = await shortRes.json();

  const long = await api<{ access_token: string; expires_in: number }>('/access_token', {
    grant_type: 'th_exchange_token',
    client_secret: process.env.THREADS_APP_SECRET!,
    access_token: short.access_token,
  });
  return {
    accessToken: long.access_token,
    userId: String(short.user_id),
    expiresAt: new Date(Date.now() + long.expires_in * 1000).toISOString(),
  };
}

export async function refreshLongLivedToken(token: string): Promise<{ accessToken: string; expiresAt: string }> {
  const r = await api<{ access_token: string; expires_in: number }>('/refresh_access_token', {
    grant_type: 'th_refresh_token',
    access_token: token,
  });
  return { accessToken: r.access_token, expiresAt: new Date(Date.now() + r.expires_in * 1000).toISOString() };
}

export async function fetchProfile(token: string): Promise<ThreadsProfile> {
  if (isMockThreads()) {
    return { id: MOCK_USER.id, username: MOCK_USER.username, name: MOCK_USER.name, biography: MOCK_USER.bio };
  }
  const r = await api<{ id: string; username: string; name?: string; threads_biography?: string }>('/v1.0/me', {
    fields: 'id,username,name,threads_biography',
    access_token: token,
  });
  return { id: r.id, username: r.username, name: r.name, biography: r.threads_biography };
}

export interface PostsPage {
  posts: Post[];
  nextCursor: string | null;
}

// 글 목록 1페이지 (목업: 60개를 25개씩 페이지네이션)
export async function fetchPostsPage(token: string, userId: string, cursor: string | null, since?: string): Promise<PostsPage> {
  if (isMockThreads()) {
    const { posts } = generateMockPosts(userId);
    const filtered = since ? posts.filter((p) => p.timestamp > since) : posts;
    const offset = cursor ? parseInt(cursor, 10) : 0;
    const page = filtered.slice(offset, offset + 25);
    const next = offset + 25 < filtered.length ? String(offset + 25) : null;
    return { posts: page, nextCursor: next };
  }
  const params: Record<string, string> = {
    fields: 'id,text,timestamp,media_type,permalink',
    limit: '100',
    access_token: token,
  };
  if (cursor) params.after = cursor;
  if (since) params.since = String(Math.floor(new Date(since).getTime() / 1000));
  const r = await api<{
    data: Array<{ id: string; text?: string; timestamp: string; media_type: string; permalink?: string }>;
    paging?: { cursors?: { after?: string }; next?: string };
  }>('/v1.0/me/threads', params);
  return {
    posts: r.data.map((p) => ({
      id: p.id,
      user_id: userId,
      text: p.text ?? '',
      timestamp: p.timestamp,
      media_type: p.media_type,
      permalink: p.permalink ?? '',
    })),
    nextCursor: r.paging?.next ? (r.paging.cursors?.after ?? null) : null,
  };
}

export async function fetchPostInsights(token: string, postId: string): Promise<Insight> {
  if (isMockThreads()) {
    const { insights } = generateMockPosts(MOCK_USER.id);
    const found = insights.find((i) => i.post_id === postId);
    return (
      found ?? { post_id: postId, views: 500, likes: 20, replies: 3, reposts: 1, quotes: 0, fetched_at: new Date().toISOString() }
    );
  }
  const r = await api<{ data: Array<{ name: string; values?: Array<{ value: number }>; total_value?: { value: number } }> }>(
    `/v1.0/${postId}/insights`,
    { metric: 'views,likes,replies,reposts,quotes', access_token: token }
  );
  const get = (name: string) => {
    const m = r.data.find((d) => d.name === name);
    return m?.total_value?.value ?? m?.values?.[0]?.value ?? 0;
  };
  return {
    post_id: postId,
    views: get('views'),
    likes: get('likes'),
    replies: get('replies'),
    reposts: get('reposts'),
    quotes: get('quotes'),
    fetched_at: new Date().toISOString(),
  };
}

export async function fetchAccountInsights(token: string): Promise<{ followersCount: number; views: number }> {
  if (isMockThreads()) {
    const now = new Date();
    return { followersCount: mockFollowersOn(now), views: mockAccountViewsOn(now) };
  }
  const r = await api<{ data: Array<{ name: string; values?: Array<{ value: number }>; total_value?: { value: number } }> }>(
    '/v1.0/me/threads_insights',
    { metric: 'views,followers_count', access_token: token }
  );
  const get = (name: string) => {
    const m = r.data.find((d) => d.name === name);
    return m?.total_value?.value ?? m?.values?.at(-1)?.value ?? 0;
  };
  return { followersCount: get('followers_count'), views: get('views') };
}

// 발행 2단계: 컨테이너 생성 → 발행
export async function publishPost(token: string, userId: string, text: string): Promise<{ id: string; permalink?: string }> {
  if (isMockThreads()) {
    const id = `mock-published-${Date.now()}`;
    return { id, permalink: `https://www.threads.net/@${MOCK_USER.username}/post/${id}` };
  }
  const createRes = await fetch(`${GRAPH}/v1.0/me/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ media_type: 'TEXT', text, access_token: token }),
  });
  if (!createRes.ok) throw new Error(`발행 컨테이너 생성 실패 (${createRes.status}): ${(await createRes.text()).slice(0, 300)}`);
  const { id: containerId } = await createRes.json();

  const pubRes = await fetch(`${GRAPH}/v1.0/me/threads_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ creation_id: containerId, access_token: token }),
  });
  if (!pubRes.ok) throw new Error(`발행 실패 (${pubRes.status}): ${(await pubRes.text()).slice(0, 300)}`);
  const { id } = await pubRes.json();
  return { id };
}
