import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import GrowthClient from '@/components/GrowthClient';

export const dynamic = 'force-dynamic';

export default async function GrowthPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <GrowthClient />;
}
