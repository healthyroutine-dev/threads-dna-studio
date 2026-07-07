'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: '홈', icon: '⌂' },
  { href: '/dna', label: 'DNA', icon: '🧬' },
  { href: '/write', label: '쓰기', icon: '✎' },
  { href: '/archive', label: '아카이브', icon: '☰' },
  { href: '/growth', label: '성장', icon: '↗' },
];

export default function TabBar() {
  const pathname = usePathname();
  if (pathname === '/login') return null;
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md border-t border-x border-line bg-paper z-50">
      <div className="grid grid-cols-5">
        {TABS.map((tab) => {
          const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${
                active ? 'text-brand font-bold' : 'text-muted'
              }`}
            >
              <span className="text-base leading-none">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
