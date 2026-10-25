'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />,
  zap: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  megaphone: <path d="M3 10v4h4l6 4V6L7 10zm13-1a4 4 0 0 1 0 6" />,
  file: <path d="M14 3H6v18h12V7zm0 0v4h4M9 13h6m-6 4h6" />,
  bag: <path d="M5 8h14l-1 13H6zm4 0V6a3 3 0 0 1 6 0v2" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  wallet: <path d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm0 0 3-3h11v3m-1 7h2" />,
  key: <path d="M14.5 9.5 21 3m-3 3 2 2m-9.5 3.5a4.5 4.5 0 1 1-6.4 6.4 4.5 4.5 0 0 1 6.4-6.4z" />,
};

const NAV = [
  { href: '/dashboard', label: 'Home', icon: 'home' },
  { href: '/dashboard/use-cases', label: 'OTP & updates', icon: 'zap' },
  { href: '/dashboard/promotions', label: 'Promotions', icon: 'megaphone' },
  { href: '/dashboard/store', label: 'Online store', icon: 'bag' },
  { href: '/dashboard/templates', label: 'Templates', icon: 'file' },
  { href: '/dashboard/messages', label: 'Message log', icon: 'list' },
  { href: '/dashboard/wallet', label: 'Wallet', icon: 'wallet' },
  { href: '/dashboard/developers', label: 'API keys', icon: 'key' },
];

export function Sidebar({ brand }: { brand: string }) {
  const path = usePathname();
  return (
    <aside className="bg-brand-800 text-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0">
      <Link href="/dashboard" className="block px-6 py-5 text-lg font-bold">
        {brand}
      </Link>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
        {NAV.map((item) => {
          const active = item.href === '/dashboard' ? path === item.href : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {ICONS[item.icon]}
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
