import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import ArchiveClient from '@/components/ArchiveClient';

export const dynamic = 'force-dynamic';

export default async function ArchivePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <ArchiveClient />;
}
