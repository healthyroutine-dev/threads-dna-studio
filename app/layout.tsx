import type { Metadata } from 'next';
import './globals.css';
import TabBar from '@/components/TabBar';
import MockBadge from '@/components/MockBadge';

export const metadata: Metadata = {
  title: '스레드 DNA 스튜디오',
  description: '내 스레드 계정의 콘텐츠 DNA를 추출하고, 그 DNA로 글을 쓰는 스튜디오',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased">
        <div className="mx-auto max-w-md min-h-screen flex flex-col border-x border-line bg-paper">
          <MockBadge />
          <main className="flex-1 pb-20">{children}</main>
          <TabBar />
        </div>
      </body>
    </html>
  );
}
