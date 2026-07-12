'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface PostWithInsight {
  id: string;
  text: string;
  timestamp: string;
  permalink: string;
  insight: { views: number; likes: number; replies: number; reposts: number; quotes: number } | null;
}

interface SyncState {
  mode: string;
  status: 'idle' | 'running' | 'done' | 'error';
  phase: string;
  total: number;
  done: number;
  message?: string;
}

const SYNC_BUTTONS = [
  { mode: 'all', label: '전체 동기화' },
  { mode: 'posts', label: '글만' },
  { mode: 'recent', label: '최신만' },
  { mode: 'insights', label: '통계만' },
];

type SortKey = 'recent' | 'likes' | 'views';

export function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export function PostCard({ post, rank }: { post: PostWithInsight; rank?: number }) {
  const [expanded, setExpanded] = useState(false);
  const i = post.insight;
  return (
    <div className="rounded-xl border border-line bg-white/60 p-3">
      <div className="flex items-start gap-2">
        {rank !== undefined && (
          <span className={`text-sm font-bold shrink-0 ${rank <= 3 ? 'text-brand' : 'text-muted'}`}>{rank}위</span>
        )}
        <p
          className={`text-sm whitespace-pre-wrap leading-relaxed flex-1 ${expanded ? '' : 'line-clamp-3'}`}
          onClick={() => setExpanded((v) => !v)}
        >
          {post.text || '(본문 없음)'}
        </p>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
        <span>
          {i ? `조회 ${i.views.toLocaleString()} · 좋아요 ${i.likes.toLocaleString()} · 댓글 ${i.replies}` : '통계 미수집'}
        </span>
        <span className="flex items-center gap-2">
          {formatDate(post.timestamp)}
          {post.permalink && (
            <a href={post.permalink} target="_blank" rel="noreferrer" className="underline">
              열기
            </a>
          )}
        </span>
      </div>
    </div>
  );
}

export default function ArchiveClient() {
  const [posts, setPosts] = useState<PostWithInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [sync, setSync] = useState<SyncState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const stopRef = useRef(false);

  const loadPosts = useCallback(async () => {
    const r = await fetch('/api/posts');
    if (r.ok) setPosts((await r.json()).posts);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPosts();
    fetch('/api/sync').then(async (r) => {
      if (r.ok) setSync((await r.json()).state);
    });
  }, [loadPosts]);

  async function runSync(mode: string) {
    if (syncing) {
      stopRef.current = true; // 일시정지 (이어하기 가능)
      return;
    }
    stopRef.current = false;
    setSyncing(true);
    try {
      let running = true;
      while (running && !stopRef.current) {
        const r = await fetch('/api/sync/step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode }),
        });
        if (!r.ok) break;
        const { state } = await r.json();
        setSync(state);
        running = state.status === 'running';
        if (state.phase === 'insights' && state.done % 50 === 0) await loadPosts();
      }
    } finally {
      setSyncing(false);
      await loadPosts();
    }
  }

  const filtered = useMemo(() => {
    let list = posts;
    if (query.trim()) list = list.filter((p) => p.text.includes(query.trim()));
    const by = {
      recent: (a: PostWithInsight, b: PostWithInsight) => b.timestamp.localeCompare(a.timestamp),
      likes: (a: PostWithInsight, b: PostWithInsight) => (b.insight?.likes ?? -1) - (a.insight?.likes ?? -1),
      views: (a: PostWithInsight, b: PostWithInsight) => (b.insight?.views ?? -1) - (a.insight?.views ?? -1),
    }[sort];
    return [...list].sort(by);
  }, [posts, query, sort]);

  const top10 = useMemo(
    () => [...posts].sort((a, b) => (b.insight?.likes ?? -1) - (a.insight?.likes ?? -1)).slice(0, 10),
    [posts]
  );
  const [showTop, setShowTop] = useState(false);

  const pct = sync && sync.phase === 'insights' && sync.total > 0 ? Math.round((sync.done / sync.total) * 100) : null;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">아카이브</h1>

      {/* 동기화 */}
      <div className="rounded-xl border border-line p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">동기화</span>
          <span className="text-[11px] text-muted">글 {posts.length}개 보관 중</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {SYNC_BUTTONS.map((b) => (
            <button
              key={b.mode}
              onClick={() => runSync(b.mode)}
              className="rounded-lg border border-line bg-white/60 py-2 text-[11px] font-medium active:bg-line disabled:opacity-40"
            >
              {syncing && sync?.mode === b.mode ? '⏸ 중지' : b.label}
            </button>
          ))}
        </div>
        {sync && sync.status !== 'idle' && (
          <div className="space-y-1">
            <div className="h-1.5 rounded-full bg-line overflow-hidden">
              <div
                className={`h-full rounded-full ${sync.status === 'error' ? 'bg-brand' : 'bg-ink'} transition-all`}
                style={{ width: `${sync.status === 'done' ? 100 : (pct ?? (syncing ? 30 : 0))}%` }}
              />
            </div>
            <p className="text-[11px] text-muted">
              {sync.status === 'error' ? `⚠ 오류: ${sync.message}` : sync.status === 'done' ? `✓ 완료 — ${sync.message}` : `${sync.message}${pct !== null ? ` (${pct}%)` : ''}${!syncing ? ' — 일시정지됨(같은 버튼으로 이어하기)' : ''}`}
            </p>
          </div>
        )}
      </div>

      {/* 인기 TOP10 */}
      <div className="rounded-xl border border-line p-3">
        <button onClick={() => setShowTop((v) => !v)} className="w-full flex items-center justify-between text-sm font-bold">
          🔥 인기 TOP 10 (좋아요)
          <span className="text-muted">{showTop ? '▲' : '▼'}</span>
        </button>
        {showTop && (
          <div className="mt-2 space-y-2">
            {top10.map((p, idx) => (
              <PostCard key={p.id} post={p} rank={idx + 1} />
            ))}
          </div>
        )}
      </div>

      {/* 검색·정렬 */}
      <div className="space-y-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="글 내용 검색"
          className="w-full rounded-xl border border-line bg-white/60 px-3 py-2.5 text-sm outline-none"
        />
        <div className="flex gap-1.5">
          {(
            [
              ['recent', '최신순'],
              ['likes', '좋아요순'],
              ['views', '조회순'],
            ] as [SortKey, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={`rounded-full px-3 py-1 text-[11px] border ${
                sort === k ? 'bg-ink text-paper border-ink' : 'border-line text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      {loading ? (
        <p className="text-sm text-muted text-center py-8">불러오는 중…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">
          {posts.length === 0 ? '아직 글이 없어요. 위에서 [전체 동기화]를 눌러 주세요.' : '검색 결과가 없어요.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}
