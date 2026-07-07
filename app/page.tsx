import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { applyUserEdits } from '@/lib/dna';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const store = await getStore();
  const [snapshots, dnaRaw, posts] = await Promise.all([
    store.getSnapshots(user.id),
    store.getLatestDna(user.id),
    store.getPosts(user.id),
  ]);
  const dna = dnaRaw ? applyUserEdits(dnaRaw) : null;
  const withText = posts.filter((p) => p.text.trim().length > 0);

  const last = snapshots[snapshots.length - 1];
  const prev = snapshots[snapshots.length - 2];
  const delta = last && prev ? last.followers_count - prev.followers_count : null;

  // DNA 업데이트 추천: 새 글 20개↑ 또는 30일 경과 또는 임시 DNA인데 글 15개↑
  let updateBadge = false;
  if (dnaRaw) {
    const newPosts = withText.filter((p) => p.timestamp > dnaRaw.extracted_at).length;
    const ageDays = (Date.now() - new Date(dnaRaw.extracted_at).getTime()) / 86400_000;
    updateBadge = newPosts >= 20 || ageDays >= 30 || (dnaRaw.provisional === true && withText.length >= 15);
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">@{user.username}</h1>
          <p className="text-[11px] text-muted">스레드 DNA 스튜디오</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button className="text-[11px] text-muted underline">로그아웃</button>
        </form>
      </div>

      {/* 팔로워 현황 */}
      <Link href="/growth" className="block rounded-xl border border-line bg-white/60 p-4">
        <p className="text-[11px] text-muted">팔로워</p>
        {last ? (
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold">{last.followers_count.toLocaleString()}</span>
            {delta !== null && (
              <span className={`text-sm font-bold pb-1 ${delta >= 0 ? 'text-brand' : 'text-muted'}`}>
                {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} (전일 대비)
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted mt-1">성장 탭에 방문하면 기록이 시작돼요 →</p>
        )}
      </Link>

      {/* DNA 카드 요약 */}
      <Link href="/dna" className="block rounded-xl border border-line bg-white/60 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">🧬 내 콘텐츠 DNA</p>
          <span className="flex items-center gap-1.5">
            {updateBadge && (
              <span className="text-[10px] rounded-full bg-brand text-paper px-2 py-0.5 font-bold">업데이트 추천</span>
            )}
            {dnaRaw && <span className="text-[10px] text-muted">v{dnaRaw.version}</span>}
          </span>
        </div>
        {dna ? (
          <>
            <p className="text-[12px] leading-relaxed line-clamp-2">{dna.identity}</p>
            {dna.winning_axes[0] && (
              <div className="rounded-lg bg-paper border border-line p-2.5">
                <p className="text-[12px] font-bold text-brand">잘되는 축 1위 · {dna.winning_axes[0].axis}</p>
                <p className="text-[11px] text-muted mt-0.5">📊 {dna.winning_axes[0].evidence}</p>
              </div>
            )}
            <p className="text-[11px] text-muted">
              말투 규칙 {dna.tone_rules.length}개 · 글 {dnaRaw!.post_count_analyzed}개 분석
              {dnaRaw!.provisional && ' · 임시 DNA'}
            </p>
          </>
        ) : (
          <p className="text-[12px] text-muted">
            {withText.length === 0
              ? '먼저 아카이브 탭에서 글을 동기화해 주세요 →'
              : `글 ${withText.length}개가 준비됐어요. 탭해서 DNA를 추출해 보세요 →`}
          </p>
        )}
      </Link>

      {/* 오늘의 글감 */}
      <Link href="/write" className="block rounded-xl bg-brand text-paper p-4 text-center font-bold">
        ✍️ 오늘의 글감 받기
      </Link>

      {/* 시작 가이드 (데이터 없을 때) */}
      {withText.length === 0 && (
        <div className="rounded-xl border border-line p-4 space-y-2 text-[12px]">
          <p className="font-bold text-sm">시작 가이드</p>
          <p>1. ✅ 스레드 계정 연결 완료</p>
          <p>
            2. <Link href="/archive" className="underline">아카이브에서 글·통계 동기화</Link>
          </p>
          <p>
            3. <Link href="/dna" className="underline">DNA 추출</Link> → 4. 쓰기 탭에서 글감 받기
          </p>
        </div>
      )}
    </div>
  );
}
