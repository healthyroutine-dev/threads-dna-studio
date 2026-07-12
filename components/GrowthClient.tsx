'use client';

import { useEffect, useState } from 'react';
import LineChart from './LineChart';

interface Snapshot {
  date: string;
  followers_count: number;
  views: number;
}

interface Diagnosis {
  diagnosis: string;
  next_actions: string[];
}

export default function GrowthClient() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [diag, setDiag] = useState<Diagnosis | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(null);

  useEffect(() => {
    // 방문 시 오늘 스냅샷 자동 기록
    fetch('/api/followers', { method: 'POST' })
      .then(async (r) => {
        if (r.ok) setSnapshots((await r.json()).snapshots);
      })
      .finally(() => setLoading(false));
  }, []);

  async function runDiagnose() {
    setDiagLoading(true);
    setDiagError(null);
    try {
      const r = await fetch('/api/ai/diagnose', { method: 'POST' });
      const data = await r.json();
      if (!r.ok) setDiagError(data.error ?? '진단에 실패했어요.');
      else setDiag(data);
    } finally {
      setDiagLoading(false);
    }
  }

  const last = snapshots[snapshots.length - 1];
  const prev = snapshots[snapshots.length - 2];
  const delta = last && prev ? last.followers_count - prev.followers_count : null;

  const changes = [...snapshots]
    .slice(-8)
    .map((s, i, arr) => ({
      date: s.date,
      count: s.followers_count,
      delta: i > 0 ? s.followers_count - arr[i - 1].followers_count : null,
    }))
    .reverse()
    .slice(0, 7);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">성장</h1>

      {loading ? (
        <p className="text-sm text-muted text-center py-8">불러오는 중…</p>
      ) : (
        <>
          {/* 현황 */}
          <div className="rounded-xl border border-line p-4 bg-white/60">
            <p className="text-[11px] text-muted">현재 팔로워</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold">{last?.followers_count.toLocaleString() ?? '—'}</span>
              {delta !== null && (
                <span className={`text-sm font-bold pb-1 ${delta >= 0 ? 'text-brand' : 'text-muted'}`}>
                  {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} (전일 대비)
                </span>
              )}
            </div>
          </div>

          {/* 차트 */}
          <div className="rounded-xl border border-line p-3">
            <p className="text-sm font-bold mb-1">팔로워 추이</p>
            <LineChart points={snapshots.map((s) => ({ label: s.date.slice(5), value: s.followers_count }))} />
          </div>

          {/* 일별 변화 */}
          <div className="rounded-xl border border-line p-3">
            <p className="text-sm font-bold mb-2">일별 변화</p>
            <div className="space-y-1.5">
              {changes.map((c) => (
                <div key={c.date} className="flex items-center justify-between text-sm">
                  <span className="text-muted text-[12px]">{c.date}</span>
                  <span>
                    {c.count.toLocaleString()}명
                    {c.delta !== null && (
                      <span className={`ml-2 text-[11px] font-bold ${c.delta >= 0 ? 'text-brand' : 'text-muted'}`}>
                        {c.delta >= 0 ? '+' : ''}
                        {c.delta}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* AI 진단 */}
          <div className="rounded-xl border border-line p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">AI 성장 진단</p>
              <button
                onClick={runDiagnose}
                disabled={diagLoading}
                className="rounded-lg bg-ink text-paper px-3 py-1.5 text-[12px] font-bold disabled:opacity-40"
              >
                {diagLoading ? '진단 중…' : diag ? '다시 진단' : '진단 받기'}
              </button>
            </div>
            {diagError && <p className="text-[12px] text-brand">{diagError}</p>}
            {diag && (
              <div className="space-y-2">
                <p className="text-sm leading-relaxed">{diag.diagnosis}</p>
                <div>
                  <p className="text-[11px] font-bold text-muted mb-1">이번 주 액션</p>
                  <ul className="space-y-1">
                    {diag.next_actions.map((a, i) => (
                      <li key={i} className="text-sm flex gap-1.5">
                        <span className="text-brand font-bold">{i + 1}.</span>
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
