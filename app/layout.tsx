import type { Metadata, Viewport } from 'next';
import { Space_Mono, DM_Sans, Archivo, Newsreader, JetBrains_Mono } from 'next/font/google';
import { Suspense } from 'react';
import { AuthTrigger } from '@/components/auth/AuthTrigger';
import { TravelpayoutsDriveScript } from '@/components/TravelpayoutsDriveScript';
import './globals.css';

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
});

// FRONT-001 — v3 design foundation fonts (additive, alongside the legacy
// Space Mono / DM Sans above). Consumed via the --ctv3-* CSS variables in
// globals.css by components/design/** and the /_design-preview route.
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crisis-travel.app';
const APP_TITLE = 'Crisis Travel — Voyage intelligent en temps de crise';
const APP_DESCRIPTION =
  "Crisis Travel analyse une sélection de destinations opportunistes, émergentes ou sous-évaluées en tenant compte du contexte géopolitique, sécuritaire et économique mondial. Propulsé par l'IA.";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a0f',
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: APP_TITLE,
  description: APP_DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: 'Crisis Travel',
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    url: APP_URL,
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: APP_TITLE,
    description: APP_DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`dark ${spaceMono.variable} ${dmSans.variable} ${archivo.variable} ${newsreader.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen antialiased" style={{ backgroundColor: '#0a0a0f', color: '#e8e8e8', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
        {children}
        <Suspense fallback={null}>
          <AuthTrigger />
        </Suspense>
        <TravelpayoutsDriveScript />
      </body>
    </html>
  );
}
