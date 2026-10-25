import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { BRAND, SITE } from '@/lib/env';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

const description =
  'Send OTPs, order updates, reminders and promotions on WhatsApp. Connect in 2 minutes, send with one API call, pay per delivered message.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${BRAND}: WhatsApp OTP, order updates and promotions`, template: `%s · ${BRAND}` },
  description,
  openGraph: { type: 'website', siteName: BRAND, title: BRAND, description },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
