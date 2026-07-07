import { isMockThreads, isMockAi } from '@/lib/env';

export default function MockBadge() {
  const mocks: string[] = [];
  if (isMockThreads()) mocks.push('Threads');
  if (isMockAi()) mocks.push('AI');
  if (mocks.length === 0) return null;
  return (
    <div className="bg-ink text-paper text-[11px] text-center py-1">
      목업 모드 ({mocks.join(' · ')}) — 환경변수를 설정하면 실제 연동으로 전환됩니다
    </div>
  );
}
