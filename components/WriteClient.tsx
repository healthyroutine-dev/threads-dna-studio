'use client';

import { useCallback, useEffect, useState } from 'react';

interface Idea {
  id: string;
  topic: string;
  axis: string;
  direction: string;
}

interface Prediction {
  score: number;
  expected: string;
  strengths: string[];
  weaknesses: string[];
  improved: string;
}

interface Draft {
  id: string;
  topic: string;
  axis: string;
  text: string;
  prediction: Prediction | null;
  prediction_stale: boolean;
  improved_applied: boolean;
  updated_at: string;
}

interface RecordItem {
  id: string;
  text: string;
  published_at: string;
  permalink?: string;
}

export default function WriteClient() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [text, setText] = useState('');
  const [reviseReq, setReviseReq] = useState('');
  const [busy, setBusy] = useState<string | null>(null); // 'ideas' | 'draft' | 'revise' | 'predict' | 'publish'
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showImproved, setShowImproved] = useState(false);

  const loadLists = useCallback(async () => {
    const [dr, rr] = await Promise.all([fetch('/api/drafts'), fetch('/api/records')]);
    if (dr.ok) setDrafts((await dr.json()).drafts);
    if (rr.ok) setRecords((await rr.json()).records);
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  }

  async function call(url: string, body: unknown, tag: string): Promise<Record<string, unknown> | null> {
    setBusy(tag);
    setError(null);
    try {
      const r = await fetch(url, {
        method: url === '/api/drafts' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? '요청에 실패했어요.');
        return null;
      }
      return data;
    } finally {
      setBusy(null);
    }
  }

  async function getIdeas() {
    const data = await call('/api/ai/ideas', {}, 'ideas');
    if (data) setIdeas(data.ideas as Idea[]);
  }

  async function openIdea(idea: Idea) {
    const data = await call('/api/ai/draft', { topic: idea.topic, axis: idea.axis, direction: idea.direction }, 'draft');
    if (data) {
      const d = data.draft as Draft;
      setDraft(d);
      setText(d.text);
      setShowImproved(false);
    }
  }

  function openDraft(d: Draft) {
    setDraft(d);
    setText(d.text);
    setShowImproved(false);
  }

  async function saveText(): Promise<Draft | null> {
    if (!draft) return null;
    if (text === draft.text) return draft;
    const data = await call('/api/drafts', { id: draft.id, text }, 'save');
    if (data) {
      const d = data.draft as Draft;
      setDraft(d);
      return d;
    }
    return null;
  }

  async function revise() {
    if (!draft || !reviseReq.trim()) return;
    await saveText();
    const data = await call('/api/ai/revise', { draftId: draft.id, request: reviseReq }, 'revise');
    if (data) {
      const d = data.draft as Draft;
      setDraft(d);
      setText(d.text);
      setReviseReq('');
      flash('수정 반영 완료');
    }
  }

  async function predict() {
    if (!draft) return;
    const saved = await saveText();
    if (!saved) return;
    const data = await call('/api/ai/predict', { draftId: saved.id }, 'predict');
    if (data) {
      const d = data.draft as Draft;
      setDraft(d);
      setShowImproved(true);
    }
  }

  async function applyImproved() {
    if (!draft?.prediction) return;
    const data = await call('/api/drafts', { id: draft.id, text: draft.prediction.improved, improvedApplied: true }, 'apply');
    if (data) {
      const d = data.draft as Draft;
      setDraft(d);
      setText(d.text);
      flash('✓ 개선안 반영 완료');
    }
  }

  async function copyText() {
    await navigator.clipboard.writeText(text);
    flash('복사했어요. 스레드 앱에 붙여넣으세요!');
  }

  async function publish() {
    if (!draft) return;
    if (!confirm('스레드에 바로 발행할까요?')) return;
    await saveText();
    const data = await call('/api/publish', { text }, 'publish');
    if (data) {
      flash('발행 완료! 기록에 저장했어요.');
      await loadLists();
    }
  }

  async function recordDone() {
    if (!text.trim()) return;
    const data = await call('/api/records', { text }, 'record');
    if (data) {
      flash('발행 기록에 저장했어요.');
      await loadLists();
    }
  }

  const dirty = draft ? text !== draft.text : false;
  const stale = draft?.prediction && (draft.prediction_stale || dirty);

  // ── 에디터 뷰 ──
  if (draft) {
    const p = draft.prediction;
    return (
      <div className="p-4 space-y-3">
        <button onClick={() => setDraft(null)} className="text-[12px] text-muted">
          ← 글감 목록으로
        </button>
        <div>
          <span className="text-[10px] rounded-full bg-ink text-paper px-2 py-0.5">{draft.axis || '자유 주제'}</span>
          <h1 className="text-lg font-bold mt-1.5">{draft.topic}</h1>
        </div>

        {notice && <p className="text-[12px] text-brand font-bold">{notice}</p>}
        {error && <p className="text-[12px] text-brand">{error}</p>}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={saveText}
          rows={12}
          className="w-full rounded-xl border border-line bg-white/60 p-3 text-sm leading-relaxed outline-none"
        />

        {/* 예측 결과 */}
        {p && (
          <div className={`rounded-xl border p-3 space-y-2 ${stale ? 'border-line opacity-80' : 'border-brand/40 bg-brand/5'}`}>
            {stale && (
              <div className="rounded-lg bg-ink text-paper text-[11px] px-2.5 py-1.5 flex items-center justify-between">
                ⚠ 본문이 바뀌어 이 예측은 구버전이에요.
                <button onClick={predict} disabled={busy !== null} className="underline font-bold">
                  다시 예측
                </button>
              </div>
            )}
            {draft.improved_applied && !stale && (
              <p className="text-[11px] text-brand font-bold">✓ 개선안 반영 완료</p>
            )}
            <div className="flex items-center gap-3">
              <div className="text-center shrink-0">
                <p className="text-2xl font-bold text-brand">{p.score}</p>
                <p className="text-[10px] text-muted">점수</p>
              </div>
              <div className="text-sm">
                예상 반응: <b>좋아요 {p.expected}</b>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1 text-[12px]">
              {p.strengths.map((s, i) => (
                <p key={`s${i}`}>👍 {s}</p>
              ))}
              {p.weaknesses.map((w, i) => (
                <p key={`w${i}`}>👎 {w}</p>
              ))}
            </div>
            {!draft.improved_applied && (
              <div className="rounded-lg bg-paper border border-line p-2.5">
                <button onClick={() => setShowImproved((v) => !v)} className="w-full flex justify-between text-[12px] font-bold">
                  ✨ 개선 버전 보기 <span className="text-muted">{showImproved ? '▲' : '▼'}</span>
                </button>
                {showImproved && (
                  <>
                    <p className="mt-2 text-[12px] whitespace-pre-wrap leading-relaxed">{p.improved}</p>
                    <button
                      onClick={applyImproved}
                      disabled={busy !== null}
                      className="mt-2 rounded-lg bg-brand text-paper px-3 py-1.5 text-[12px] font-bold"
                    >
                      이 버전으로 교체
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* AI에게 수정 요청 */}
        <div className="flex gap-1.5">
          <input
            value={reviseReq}
            onChange={(e) => setReviseReq(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && revise()}
            placeholder='AI에게 수정 요청 (예: "더 짧게", "훅 바꿔줘")'
            className="flex-1 rounded-xl border border-line bg-white/60 px-3 py-2.5 text-sm outline-none"
          />
          <button
            onClick={revise}
            disabled={busy !== null || !reviseReq.trim()}
            className="rounded-xl bg-ink text-paper px-4 text-sm font-bold disabled:opacity-40"
          >
            {busy === 'revise' ? '…' : '수정'}
          </button>
        </div>

        {/* 액션 버튼 */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={predict}
            disabled={busy !== null}
            className="rounded-xl bg-brand text-paper py-2.5 text-sm font-bold disabled:opacity-40"
          >
            {busy === 'predict' ? '예측 중…' : '🔮 예측·개선'}
          </button>
          <button onClick={copyText} className="rounded-xl border border-ink py-2.5 text-sm font-bold">
            📋 복사
          </button>
          <button
            onClick={publish}
            disabled={busy !== null}
            className="rounded-xl border border-line py-2.5 text-sm font-medium text-muted disabled:opacity-40"
          >
            {busy === 'publish' ? '발행 중…' : '스레드에 바로 발행'}
          </button>
          <button
            onClick={recordDone}
            disabled={busy !== null}
            className="rounded-xl border border-line py-2.5 text-sm font-medium text-muted disabled:opacity-40"
          >
            발행 완료 → 기록
          </button>
        </div>
      </div>
    );
  }

  // ── 글감 목록 뷰 ──
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">쓰기</h1>
      {notice && <p className="text-[12px] text-brand font-bold">{notice}</p>}
      {error && <p className="text-[12px] text-brand">{error}</p>}

      <button
        onClick={getIdeas}
        disabled={busy !== null}
        className="w-full rounded-xl bg-brand text-paper py-3.5 font-bold disabled:opacity-40"
      >
        {busy === 'ideas' ? '글감 뽑는 중…' : ideas.length ? '🎲 글감 다시 받기' : '✍️ 오늘의 글감 5개 받기'}
      </button>

      {ideas.length > 0 && (
        <div className="space-y-2">
          {ideas.map((idea) => (
            <button
              key={idea.id}
              onClick={() => openIdea(idea)}
              disabled={busy !== null}
              className="w-full text-left rounded-xl border border-line bg-white/60 p-3 active:bg-line disabled:opacity-40"
            >
              <span className="text-[10px] rounded-full bg-ink text-paper px-2 py-0.5">{idea.axis}</span>
              <p className="text-sm font-bold mt-1">{idea.topic}</p>
              <p className="text-[12px] text-muted mt-0.5">{idea.direction}</p>
              <p className="text-[11px] text-brand mt-1 font-bold">{busy === 'draft' ? '초안 쓰는 중…' : '탭해서 초안 받기 →'}</p>
            </button>
          ))}
        </div>
      )}

      {drafts.length > 0 && (
        <div>
          <p className="text-sm font-bold mb-2">이어서 쓰기</p>
          <div className="space-y-1.5">
            {drafts.slice(0, 5).map((d) => (
              <button
                key={d.id}
                onClick={() => openDraft(d)}
                className="w-full text-left rounded-xl border border-line p-2.5"
              >
                <p className="text-[12px] font-bold line-clamp-1">{d.topic}</p>
                <p className="text-[11px] text-muted line-clamp-1 mt-0.5">{d.text}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {records.length > 0 && (
        <div>
          <p className="text-sm font-bold mb-2">발행 기록 ({records.length})</p>
          <div className="space-y-1.5">
            {records.slice(0, 5).map((r) => (
              <div key={r.id} className="rounded-xl border border-line p-2.5">
                <p className="text-[12px] line-clamp-2">{r.text}</p>
                <p className="text-[10px] text-muted mt-1">
                  {new Date(r.published_at).toLocaleDateString('ko-KR')}
                  {r.permalink && (
                    <a href={r.permalink} target="_blank" rel="noreferrer" className="ml-2 underline">
                      열기
                    </a>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
