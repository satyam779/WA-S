import Link from 'next/link';

/** Our mark: a speech bubble on a green square. */
export function LogoMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="6.5" fill="#0f7a5c" />
      <path
        d="M6.5 9.4A3.4 3.4 0 0 1 9.9 6h4.2a3.4 3.4 0 0 1 3.4 3.4v3.1a3.4 3.4 0 0 1-3.4 3.4h-3.3l-2.9 2.2a.5.5 0 0 1-.8-.4v-2.3a3.4 3.4 0 0 1-.6-1.9z"
        fill="#fff"
      />
    </svg>
  );
}

export function Logo({ brand, href = '/', className = '' }: { brand: string; href?: string; className?: string }) {
  return (
    <Link href={href} className={`flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-slate-900 ${className}`}>
      <LogoMark />
      {brand}
    </Link>
  );
}
