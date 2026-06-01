import type { Metadata } from 'next';
import { Space_Mono, DM_Sans } from 'next/font/google';
import { Suspense } from 'react';
import { AuthTrigger } from '@/components/auth/AuthTrigger';
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

export const metadata: Metadata = {
  title: 'Crisis Travel — Voyage intelligent en temps de crise',
  description:
    "Trouvez les meilleures destinations de voyage en tenant compte du contexte géopolitique et économique mondial en temps réel. Propulsé par l'IA.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`dark ${spaceMono.variable} ${dmSans.variable}`}>
      <body className="min-h-screen antialiased" style={{ backgroundColor: '#0a0a0f', color: '#e8e8e8', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
        {children}
        <Suspense fallback={null}>
          <AuthTrigger />
        </Suspense>
      </body>
    </html>
  );
}
