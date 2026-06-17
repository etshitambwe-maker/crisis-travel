import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { PremiumGate } from '@/components/auth/PremiumGate';
import { UserAnalysisHistory } from '@/components/crisis/UserAnalysisHistory';
import { DashboardLoginCta } from '@/components/crisis/DashboardLoginCta';
import { getUserWithSubscription } from '@/lib/auth/supabase-server';
import { SectionLabel } from '@/components/design/atoms';

export const metadata: Metadata = {
  title: 'Mon tableau de bord | Crisis Travel',
  description: 'Retrouvez vos dernières analyses Crisis Travel et reprenez une destination avec le même contexte de voyage.',
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const { user, isPremium } = await getUserWithSubscription();

  return (
    <div className="ctv3" style={{ minHeight: '100vh', background: 'var(--ctv3-ink-900)' }}>
      <Header />
      <main style={{ maxWidth: 820, margin: '0 auto', padding: '40px 20px 72px' }}>

        {/* Titre */}
        <div style={{ marginBottom: 36 }}>
          <p className="ctv3-mono" style={{
            fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'var(--ctv3-faint)', marginBottom: 10,
          }}>
            Crisis Travel · Tableau de bord
          </p>
          <h1 style={{
            fontFamily: 'var(--ctv3-display)', fontWeight: 900,
            fontSize: 'clamp(28px, 6vw, 40px)', letterSpacing: '-0.03em',
            color: 'var(--ctv3-paper)', lineHeight: 1.05, marginBottom: 10,
          }}>
            Mon tableau de bord
          </h1>
          <p className="ctv3-serif" style={{
            fontSize: 15, color: 'var(--ctv3-muted)', lineHeight: 1.55, maxWidth: 560,
          }}>
            Retrouvez vos dernières analyses Crisis Travel et reprenez une destination
            avec le même contexte de voyage.
          </p>
        </div>

        {/* Historique analyses */}
        <SectionLabel num="01" label="Historique des analyses" meta="6 mois · Premium" />

        {!user ? (
          /* Non connecté — modale de connexion directe */
          <DashboardLoginCta />
        ) : (
          /* Connecté : gating premium */
          <PremiumGate
            feature="Historique des analyses"
            description="Retrouvez toutes vos analyses des 6 derniers mois, avec le profil voyage associé et un lien direct vers la fiche destination."
            isPremium={isPremium}
            isLoggedIn={!!user}
            variant="card"
          >
            <UserAnalysisHistory />
          </PremiumGate>
        )}

      </main>
    </div>
  );
}
