'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import {
  CircleQuestionMark,
  FileText,
  House,
  KeyRound,
  List,
  Megaphone,
  MessageCircle,
  ShoppingBag,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { LogoMark } from './logo';

const NAV: { title: string; items: { href: string; label: string; icon: LucideIcon }[] }[] = [
  {
    title: 'Messaging',
    items: [
      { href: '/dashboard', label: 'Home', icon: House },
      { href: '/dashboard/chats', label: 'Chats', icon: MessageCircle },
      { href: '/dashboard/use-cases', label: 'OTP & updates', icon: Zap },
      { href: '/dashboard/promotions', label: 'Promotions', icon: Megaphone },
      { href: '/dashboard/store', label: 'Online store', icon: ShoppingBag },
      { href: '/dashboard/templates', label: 'Templates', icon: FileText },
      { href: '/dashboard/messages', label: 'Message log', icon: List },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/dashboard/wallet', label: 'Wallet', icon: Wallet },
      { href: '/dashboard/developers', label: 'API keys', icon: KeyRound },
      { href: '/dashboard/help', label: 'Help', icon: CircleQuestionMark },
    ],
  },
];

export function Sidebar({ brand, supportEmail }: { brand: string; supportEmail: string }) {
  const path = usePathname();
  return (
    <aside className="border-b border-slate-200 bg-slate-50 md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
      <Link href="/dashboard" className="flex h-14 items-center gap-2.5 px-5 text-[15px] font-semibold tracking-tight text-slate-900">
        <LogoMark className="h-6 w-6" />
        {brand}
      </Link>
      <nav className="flex gap-0.5 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:gap-6 md:overflow-y-auto md:pt-3">
        {NAV.map((group) => (
          <div key={group.title} className="flex gap-0.5 md:flex-col">
            <p className="hidden px-2.5 pb-1.5 text-xs font-medium text-slate-400 md:block">{group.title}</p>
            {group.items.map((item) => {
              const active = item.href === '/dashboard' ? path === item.href : path.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                    active ? 'font-medium text-brand-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-md border border-brand-100 bg-brand-50 shadow-[0_1px_2px_rgb(0_0_0/0.04)]"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                  <item.icon className={`relative h-4 w-4 shrink-0 ${active ? 'text-brand-600' : 'text-slate-400'}`} strokeWidth={1.8} aria-hidden />
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="hidden border-t border-slate-200 px-5 py-4 text-xs text-slate-500 md:block">
        Need a hand?{' '}
        <a href={`mailto:${supportEmail}`} className="link break-all">
          {supportEmail}
        </a>
      </div>
    </aside>
  );
}
