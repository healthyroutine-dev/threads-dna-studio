import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { isMockThreads } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect('/');
  const { error } = await searchParams;
  const mock = isMockThreads();

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center">
      <div className="text-4xl mb-3">🧬</div>
      <h1 className="text-2xl font-bold">스레드 DNA 스튜디오</h1>
      <p className="mt-3 text-sm text-muted leading-relaxed">
        스레드 계정을 연결하면 내 글과 성과를 분석해
        <br />
        나만의 콘텐츠 DNA를 추출하고,
        <br />그 DNA로 글감·초안·예측까지 도와드려요.
      </p>
      {error && (
        <p className="mt-4 text-xs text-brand">
          로그인에 실패했어요. 다시 시도해 주세요. ({error})
        </p>
      )}
      <a
        href="/api/auth/login"
        className="mt-8 w-full max-w-xs rounded-xl bg-ink text-paper py-3.5 font-bold"
      >
        {mock ? '목업 계정으로 시작하기' : 'Threads로 시작하기'}
      </a>
      {mock && (
        <p className="mt-3 text-[11px] text-muted">
          지금은 목업 모드예요. THREADS_APP_ID 등 환경변수를 설정하면
          <br />
          실제 Threads OAuth 로그인으로 전환됩니다.
        </p>
      )}
    </div>
  );
}
