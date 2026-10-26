import './globals.css';
import type { Metadata } from 'next';
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
import { BRAND, SITE } from '@/lib/env';

// Read by globals.css: Geist for text, Geist Mono for numbers and code, Instrument Serif for website headlines.
const geist = Geist({ subsets: ['latin'], display: 'swap', variable: '--font-geist' });
const geistMono = Geist_Mono({ subsets: ['latin'], display: 'swap', variable: '--font-geist-mono' });
const instrument = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], display: 'swap', variable: '--font-instrument' });

const description =
  'Send OTPs, order updates, reminders and promotions on WhatsApp. Connect in a few minutes, send with one API call, pay per delivered message.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${BRAND}: WhatsApp OTP, order updates and promotions`, template: `%s · ${BRAND}` },
  description,
  openGraph: { type: 'website', siteName: BRAND, title: BRAND, description },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${instrument.variable}`}>
      <body>{children}</body>
    </html>
  );
}
