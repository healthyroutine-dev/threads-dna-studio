import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import DnaClient from '@/components/DnaClient';

export const dynamic = 'force-dynamic';

export default async function DnaPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <DnaClient />;
}
