import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import WriteClient from '@/components/WriteClient';

export const dynamic = 'force-dynamic';

export default async function WritePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <WriteClient />;
}
