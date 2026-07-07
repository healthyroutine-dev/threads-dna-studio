import { getCurrentUser } from '@/lib/auth';
import { isMockAi, isMockThreads } from '@/lib/env';

export async function GET() {
  const user = await getCurrentUser();
  return Response.json({
    user,
    mock: { threads: isMockThreads(), ai: isMockAi() },
  });
}
