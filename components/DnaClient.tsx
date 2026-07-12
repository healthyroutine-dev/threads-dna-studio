'use client';

import { useCallback, useEffect, useState } from 'react';

interface WinningAxis {
  axis: string;
  evidence: string;
  tip: string;
}

interface Dna {
  version: number;
  extracted_at: string;
  post_count_analyzed: number;
  identity: string;
  tone_rules: string[];
  signature_hook: string;
  winning_axes: WinningAxis[];
  weakness: string;
  style_anchors: string[];
  user_edits: Record<string, unknown>;
  provisional?: boolean;
}

interface TopPost {
  id: string;
  text: string;
  likes: number;
  views: number;
}

interface DnaResponse {
  dna: Dna | null;
  effective: Dna | null;
  topPosts: TopPost[];
  postCount: number;
  updateRecommended: boolean;
}

function Section({
  title,
  edited,
  onEdit,
  onReset,
  editing,
  children,
}: {
  title: string;
  edited?: boolean;
  editing?: boolean;
  onEdit?: () => void;
  onReset?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-white/60 p-3">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-sm font-bold">
          {title}
          {edited && <span className="ml-1.5 text-[10px] text-brand font-normal">✎ 내가 수정함</span>}
        </p>
        <span className="flex gap-2">
          {edited && onReset && (
            <button onClick={onReset} className="text-[11px] text-muted underline">
              원래대로
            </button>
          )}
          {onEdit && (
            <button onClick={onEdit} className="text-[11px] text-muted underline">
              {editing ? '닫기' : '수정'}
            </button>
          )}
        </span>
      </div>
      {children}
    </div>
  );
}

export default function DnaClient() {
  const [data, setData] = useState<DnaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showAnchors, setShowAnchors] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  // 데이터 부족 모드 톤 질문 3개
  const [needAnswers, setNeedAnswers] = useState(false);
  const [answers, setAnswers] = useState({ tone: '부드러운 존댓말', emoji: '절제해서', topic: '' });

  const load = useCallback(async () => {
    const r = await fetch('/api/dna');
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function extract(withAnswers = false) {
    setExtracting(true);
    setError(null);
    try {
      const r = await fetch('/api/dna/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withAnswers ? { tone_answers: answers } : {}),
      });
      const body = await r.json();
      if (r.status === 422 && body.needToneAnswers) {
        setNeedAnswers(true);
        return;
      }
      if (!r.ok) {
        setError(body.error ?? '추출에 실패했어요.');
        return;
      }
      setNeedAnswers(false);
      await load();
    } finally {
      setExtracting(false);
    }
  }

  async function saveEdit(field: string, value: unknown) {
    const r = await fetch('/api/dna', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, value }),
    });
    if (r.ok) {
      setEditingField(null);
      await load();
    }
  }

  async function resetEdit(field: string) {
    await fetch('/api/dna', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, reset: true }),
    });
    await load();
  }

  function startEdit(field: string, current: string) {
    setEditingField(field);
    setEditValue(current);
  }

  if (loading) return <p className="p-4 text-sm text-muted text-center py-16">불러오는 중…</p>;

  const d = data?.effective;
  const raw = data?.dna;
  const edits = raw?.user_edits ?? {};

  const editor = (field: string, multiline: boolean, transform: (v: string) => unknown = (v) => v) =>
    editingField === field && (
      <div className="mt-2 space-y-1.5">
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          rows={multiline ? 6 : 3}
          className="w-full rounded-lg border border-line bg-paper px-2.5 py-2 text-sm outline-none"
        />
        <button
          onClick={() => saveEdit(field, transform(editValue))}
          className="rounded-lg bg-ink text-paper px-3 py-1.5 text-[12px] font-bold"
        >
          저장
        </button>
      </div>
    );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">DNA</h1>
        {d && (
          <button
            onClick={() => extract()}
            disabled={extracting}
            className="rounded-lg bg-ink text-paper px-3 py-1.5 text-[12px] font-bold disabled:opacity-40"
          >
            {extracting ? '추출 중…' : '🧬 다시 추출'}
          </button>
        )}
      </div>

      {error && <p className="text-[12px] text-brand">{error}</p>}

      {data?.updateRecommended && (
        <div className="rounded-xl bg-brand/10 border border-brand/30 px-3 py-2 text-[12px]">
          🔔 새 글이 쌓였어요. [다시 추출]로 DNA를 업데이트하는 걸 추천해요.
        </div>
      )}

      {/* 데이터 부족 모드: 톤 질문 3개 */}
      {needAnswers && (
        <div className="rounded-xl border border-line bg-white/60 p-4 space-y-3">
          <p className="text-sm font-bold">
            글이 아직 {data?.postCount ?? 0}개뿐이라 실측 분석이 어려워요.
            <br />
            <span className="font-normal text-muted text-[12px]">질문 3개에 답하면 임시 DNA를 만들어 드려요. (글 15개 이상 쌓이면 자동 승격 추천)</span>
          </p>
          <label className="block text-[12px]">
            1. 어떤 말투를 쓰고 싶나요?
            <select
              value={answers.tone}
              onChange={(e) => setAnswers({ ...answers, tone: e.target.value })}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-2 py-2"
            >
              <option>부드러운 존댓말</option>
              <option>단호한 존댓말</option>
              <option>친근한 반말</option>
              <option>담백한 반말</option>
            </select>
          </label>
          <label className="block text-[12px]">
            2. 이모지는 얼마나 쓰나요?
            <select
              value={answers.emoji}
              onChange={(e) => setAnswers({ ...answers, emoji: e.target.value })}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-2 py-2"
            >
              <option>절제해서</option>
              <option>거의 안</option>
              <option>자주</option>
            </select>
          </label>
          <label className="block text-[12px]">
            3. 주로 어떤 주제를 쓰나요?
            <input
              value={answers.topic}
              onChange={(e) => setAnswers({ ...answers, topic: e.target.value })}
              placeholder="예: 스레드 계정 성장, 사이드 프로젝트"
              className="mt-1 w-full rounded-lg border border-line bg-paper px-2 py-2"
            />
          </label>
          <button
            onClick={() => extract(true)}
            disabled={extracting || !answers.topic.trim()}
            className="w-full rounded-lg bg-ink text-paper py-2.5 text-sm font-bold disabled:opacity-40"
          >
            임시 DNA 만들기
          </button>
        </div>
      )}

      {!d && !needAnswers && (
        <div className="text-center py-12 space-y-3">
          <div className="text-3xl">🧬</div>
          <p className="text-sm text-muted leading-relaxed">
            아직 추출된 DNA가 없어요.
            <br />글 {data?.postCount ?? 0}개가 동기화되어 있어요.
          </p>
          <button
            onClick={() => extract()}
            disabled={extracting}
            className="rounded-xl bg-ink text-paper px-6 py-3 font-bold disabled:opacity-40"
          >
            {extracting ? '추출 중… (최대 1분)' : 'DNA 추출하기'}
          </button>
        </div>
      )}

      {d && raw && (
        <>
          <p className="text-[11px] text-muted">
            v{raw.version} · {new Date(raw.extracted_at).toLocaleDateString('ko-KR')} 추출 · 글 {raw.post_count_analyzed}개 분석
            {raw.provisional && <span className="ml-1.5 text-brand font-bold">임시 DNA (데이터 부족 모드)</span>}
          </p>

          <Section
            title="정체성"
            edited={'identity' in edits}
            editing={editingField === 'identity'}
            onEdit={() => (editingField === 'identity' ? setEditingField(null) : startEdit('identity', d.identity))}
            onReset={() => resetEdit('identity')}
          >
            <p className="text-sm leading-relaxed">{d.identity}</p>
            {editor('identity', true)}
          </Section>

          <Section
            title={`말투 규칙 (${d.tone_rules.length})`}
            edited={'tone_rules' in edits}
            editing={editingField === 'tone_rules'}
            onEdit={() =>
              editingField === 'tone_rules' ? setEditingField(null) : startEdit('tone_rules', d.tone_rules.join('\n'))
            }
            onReset={() => resetEdit('tone_rules')}
          >
            <ul className="space-y-1">
              {d.tone_rules.map((r, i) => (
                <li key={i} className="text-sm flex gap-1.5">
                  <span className="text-brand">·</span>
                  {r}
                </li>
              ))}
            </ul>
            {editingField === 'tone_rules' && <p className="mt-1 text-[10px] text-muted">한 줄에 규칙 하나씩 적어 주세요.</p>}
            {editor('tone_rules', true, (v) => v.split('\n').map((s) => s.trim()).filter(Boolean))}
          </Section>

          <Section
            title="시그니처 훅"
            edited={'signature_hook' in edits}
            editing={editingField === 'signature_hook'}
            onEdit={() =>
              editingField === 'signature_hook' ? setEditingField(null) : startEdit('signature_hook', d.signature_hook)
            }
            onReset={() => resetEdit('signature_hook')}
          >
            <p className="text-sm font-medium">“{d.signature_hook}”</p>
            {editor('signature_hook', false)}
          </Section>

          <Section title="잘되는 축 (실측 근거)">
            <div className="space-y-2.5">
              {d.winning_axes.map((a, i) => (
                <div key={i} className="rounded-lg bg-paper border border-line p-2.5">
                  <p className="text-sm font-bold text-brand">{i + 1}. {a.axis}</p>
                  <p className="text-[12px] text-muted mt-0.5">📊 {a.evidence}</p>
                  <p className="text-[12px] mt-1">💡 {a.tip}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="약점"
            edited={'weakness' in edits}
            editing={editingField === 'weakness'}
            onEdit={() => (editingField === 'weakness' ? setEditingField(null) : startEdit('weakness', d.weakness))}
            onReset={() => resetEdit('weakness')}
          >
            <p className="text-sm leading-relaxed">{d.weakness}</p>
            {editor('weakness', true)}
          </Section>

          {d.style_anchors.length > 0 && (
            <div className="rounded-xl border border-line bg-white/60 p-3">
              <button onClick={() => setShowAnchors((v) => !v)} className="w-full flex justify-between text-sm font-bold">
                스타일 앵커 ({d.style_anchors.length}편) <span className="text-muted">{showAnchors ? '▲' : '▼'}</span>
              </button>
              {showAnchors && (
                <div className="mt-2 space-y-2">
                  {d.style_anchors.map((a, i) => (
                    <p key={i} className="text-[12px] whitespace-pre-wrap rounded-lg bg-paper border border-line p-2.5 leading-relaxed">
                      {a}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-line bg-white/60 p-3">
            <button onClick={() => setShowEvidence((v) => !v)} className="w-full flex justify-between text-sm font-bold">
              추출 근거 — 히트작 TOP10 <span className="text-muted">{showEvidence ? '▲' : '▼'}</span>
            </button>
            {showEvidence && (
              <div className="mt-2 space-y-1.5">
                {(data?.topPosts ?? []).map((p, i) => (
                  <div key={p.id} className="text-[12px] flex gap-2">
                    <span className={`font-bold shrink-0 ${i < 3 ? 'text-brand' : 'text-muted'}`}>{i + 1}위</span>
                    <span className="line-clamp-2 flex-1">{p.text}</span>
                    <span className="text-muted shrink-0">♥ {p.likes.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
