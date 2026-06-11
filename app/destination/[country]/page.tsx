import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { GaugeWithTooltip } from '@/components/crisis/GaugeWithTooltip';
import { SecurityAlert } from '@/components/crisis/SecurityAlert';
import { TravelPackBlock } from '@/components/crisis/TravelPackBlock';
import { AlertButton } from '@/components/crisis/AlertButton';
import { ScoreHistory } from '@/components/crisis/ScoreHistory';
import { PremiumGate } from '@/components/auth/PremiumGate';
import type { CrisisScore } from '@/types/crisis.types';
import { calculateCrisisScore } from '@/lib/services/scoring/crisisScore.service';
import { generateDestinationNarrative } from '@/lib/claude/claude.service';
import { findCountry } from '@/lib/utils/countries';
import { getFlagUrlLarge, getCountryColors } from '@/lib/utils/countryPhoto';
import { getUserWithSubscription } from '@/lib/auth/supabase-server';
import { DestinationImage } from '@/components/design/DestinationImage';
import { CountryFlag } from '@/components/design/CountryFlag';
import { Eyebrow, SectionLabel, Chip, tierFromScore, TIER } from '@/components/design/atoms';
import { getDestinationImagery, hasDestinationPhoto } from '@/lib/design/destinationImagery';
import { MEAE_LAST_UPDATED } from '@/lib/services/security/meae.service';

// Plafond technique : scoring + synthèse Claude en Server Component peuvent
// dépasser les 10s par défaut de Vercel sur cold cache. 60s évite le timeout.
export const maxDuration = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country } = await params;
  const c = findCountry(country.toUpperCase());
  if (!c) return { title: 'Destination inconnue | Crisis Travel' };

  const statusLabels: Record<string, string> = {
    ideal: 'Destination idéale',
    recommended: 'Recommandée avec vigilance',
    possible: 'Possible avec préparation',
    discouraged: 'Fortement déconseillée',
  };

  return {
    title: `${c.name} — Fiche voyage & CrisisScore | Crisis Travel`,
    description: `Analyse géopolitique et sécuritaire de ${c.name} pour les voyageurs français. Niveaux MEAE intégrés, budget estimé, alertes sécurité et synthèse IA.`,
    openGraph: {
      title: `Est-ce sûr de voyager en ${c.name} en ce moment ?`,
      description: `Analyse CrisisScore de ${c.name} — sécurité, géopolitique, budget. Sources officielles MEAE, State Dept, ACLED.`,
      type: 'article',
      locale: 'fr_FR',
      siteName: 'Crisis Travel',
    },
    alternates: {
      canonical: `/destination/${country.toLowerCase()}`,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}


const MEAE_DATA: Record<number, { title: string; desc: string; ic: string }> = {
  1: { title: 'Surveillance normale',           desc: "Aucune précaution particulière au-delà de la vigilance usuelle.", ic: '✓' },
  2: { title: 'Vigilance renforcée',            desc: 'Prendre des précautions supplémentaires dans certaines zones.',    ic: '!' },
  3: { title: 'Déconseillé sauf impératif',     desc: "Ne s'y rendre que si un motif professionnel ou familial impératif l'exige.", ic: '⚠' },
  4: { title: 'Formellement déconseillé',       desc: 'Toute présence est fortement déconseillée, quel que soit le motif.', ic: '✕' },
};

// MEAE tier → ctv3 verdict color (legible, namespaced).
const MEAE_COLOR: Record<number, string> = {
  1: 'var(--ctv3-ideal)',
  2: 'var(--ctv3-reco)',
  3: 'var(--ctv3-poss)',
  4: 'var(--ctv3-deco)',
};

interface Props {
  params: Promise<{ country: string }>;
}

type DestinationData = { score: CrisisScore; narrative: string; flagUrl: string; colors: [string, string] };
type DestinationResult =
  | { kind: 'ok'; data: DestinationData }
  | { kind: 'not_found' }      // le code pays n'existe pas dans notre référentiel
  | { kind: 'error' };          // le pays existe mais l'analyse a échoué techniquement

async function getData(code: string): Promise<DestinationResult> {
  const country = findCountry(code);
  if (!country) return { kind: 'not_found' };
  try {
    const profile = { departureCountry: 'FR', budget: 1500, duration: 7, period: 'flexible', travelType: 'solo' as const, mode: 'standard' as const };
    const score = await calculateCrisisScore(country, profile);
    const narrative = await generateDestinationNarrative(score, profile);
    return { kind: 'ok', data: { score, narrative, flagUrl: getFlagUrlLarge(code), colors: getCountryColors(code) } };
  } catch {
    // Le pays existe mais une exception est survenue (scoring/narrative) —
    // ce n'est PAS une erreur "introuvable", c'est un échec technique.
    return { kind: 'error' };
  }
}

export default async function DestinationPage({ params }: Props) {
  const { country } = await params;
  const [result, { user, isPremium }] = await Promise.all([
    getData(country.toUpperCase()),
    getUserWithSubscription(),
  ]);

  if (result.kind !== 'ok') {
    // Deux messages distincts : pays inconnu de notre référentiel vs panne technique.
    const isNotFound = result.kind === 'not_found';
    return (
      <div className="ctv3" style={{ minHeight: '100vh', background: 'var(--ctv3-ink-900)' }}>
        <Header />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, padding: '0 24px', textAlign: 'center' }}>
          <Eyebrow red={!isNotFound}>{isNotFound ? 'Hors couverture' : 'Analyse indisponible'}</Eyebrow>
          <h1 style={{
            fontFamily: 'var(--ctv3-display)', fontWeight: 900,
            fontSize: 'clamp(28px, 6vw, 40px)', letterSpacing: '-0.03em',
            color: isNotFound ? 'var(--ctv3-muted)' : 'var(--ctv3-red-2)',
          }}>
            {isNotFound ? 'Destination inconnue' : 'Analyse indisponible'}
          </h1>
          <p className="ctv3-serif" style={{ color: 'var(--ctv3-muted)', fontSize: 15, maxWidth: 380, lineHeight: 1.55 }}>
            {isNotFound
              ? 'Ce pays ne fait pas partie des destinations analysées par Crisis Travel.'
              : 'L\'analyse n\'a pas pu aboutir — les sources de données sont momentanément indisponibles. Réessayez dans quelques instants.'}
          </p>
          <a href="/" className="ctv3-mono" style={{
            padding: '10px 20px', textDecoration: 'none',
            border: '1px solid var(--ctv3-line-bright)', color: 'var(--ctv3-paper)',
            fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            ← Retour à l’accueil
          </a>
        </div>
      </div>
    );
  }

  const { score, narrative } = result.data;
  const ident = getDestinationImagery(score.countryCode);
  const tier = tierFromScore(score.total);
  const tierInfo = TIER[tier];
  const meaeLevel = Math.min(4, Math.max(1, Number(score.security.details.meaeLevel ?? 2)));
  const meae = MEAE_DATA[meaeLevel];
  const meaeColor = MEAE_COLOR[meaeLevel];
  const majDate = new Date(score.calculatedAt).toLocaleDateString('fr-FR');
  const countryInfo = findCountry(score.countryCode);
  const meaeOfficialUrl = countryInfo?.meaeSlug
    ? `https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/conseils-par-pays-destination/${countryInfo.meaeSlug}/`
    : 'https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/conseils-par-pays-destination/';

  const subScores = [
    { lbl: 'Sécurité',     key: 'security' as const,     weight: 40 },
    { lbl: 'Géopolitique', key: 'geopolitical' as const, weight: 30 },
    { lbl: 'Budget',       key: 'budget' as const,        weight: 20 },
    { lbl: 'Praticité',    key: 'practicality' as const,  weight: 10 },
  ];

  // Real budget rows — only rendered when the payload actually carries the value.
  const fx = score.budget.details.currencyVariation;
  const budgetRows = [
    score.budget.details.mealCheap && {
      label: 'Repas bon marché', sub: '~3 repas / jour',
      val: `${score.budget.details.mealCheap}€`,
    },
    score.budget.details.hotelAvg && {
      label: 'Hôtel moyen × 14', sub: 'Médiane hôtel 3★',
      val: `${(Number(score.budget.details.hotelAvg) * 14).toLocaleString('fr-FR')}€`,
    },
    fx !== undefined && {
      label: `Impact FX · ${score.countryCode}`,
      sub: Number(fx) > 5 ? 'Avantageux vs EUR' : 'Neutre',
      val: `${Number(fx) > 0 ? '+' : ''}${fx}%`,
    },
  ].filter(Boolean) as { label: string; sub: string; val: string }[];

  return (
    <div className="ctv3" style={{ minHeight: '100vh', background: 'var(--ctv3-ink-900)' }}>
      <Header />

      {/* ── Hero — editorial destination identity (FRONT-001 imagery + flag) ── */}
      <DestinationImage
        code={score.countryCode}
        slot="hero"
        height={300}
        showLabel={false}
        scrim="strong"
        hasPhoto={hasDestinationPhoto(score.countryCode)}
      >
        <div style={{
          position: 'absolute', inset: 0, zIndex: 3,
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          maxWidth: 820, margin: '0 auto', padding: '0 20px 26px', width: '100%',
        }}>
          <Eyebrow style={{ color: 'rgba(245,245,247,0.7)' }}>
            {score.countryCode} · {ident.region || 'Fiche destination'}
          </Eyebrow>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '12px 0 10px' }}>
            <CountryFlag code={score.countryCode} width={48} />
            <h1 style={{
              fontFamily: 'var(--ctv3-display)', fontWeight: 900,
              fontSize: 'clamp(32px, 7vw, 52px)', letterSpacing: '-0.04em',
              color: '#fff', lineHeight: 0.98, textShadow: '0 2px 12px rgba(0,0,0,0.6)',
            }}>
              {score.country}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Chip tier={tier} solid>{tierInfo.label}</Chip>
            <span className="ctv3-mono" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(245,245,247,0.7)' }}>
              Mise à jour {majDate}
            </span>
          </div>
        </div>
      </DestinationImage>

      <main style={{ maxWidth: 820, margin: '0 auto', padding: '32px 20px 72px' }}>

        {/* Verdict line + source honesty (real `source` field, kept) */}
        <section style={{ marginBottom: 32 }}>
          <p className="ctv3-serif" style={{ fontSize: 18, color: 'var(--ctv3-paper)', lineHeight: 1.45, marginBottom: 14 }}>
            {tierInfo.verdict}.
          </p>
          {score.confidence === 'low' && (
            <p className="ctv3-mono" style={{ fontSize: 11, color: 'var(--ctv3-reco)', letterSpacing: '0.04em', marginBottom: 12 }}>
              ⚠ Données partielles — certaines sources étaient indisponibles au calcul.
            </p>
          )}
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {(['security', 'geopolitical', 'budget'] as const).map((key) => {
              const live = score[key].source === 'live';
              return (
                <span key={key} className="ctv3-mono" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase',
                  padding: '4px 9px', border: '1px solid var(--ctv3-line)',
                  color: 'var(--ctv3-muted)', fontWeight: 500,
                }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: live ? 'var(--ctv3-ideal)' : 'var(--ctv3-reco)',
                  }} />
                  {key === 'geopolitical' ? 'Géo' : key === 'security' ? 'Sécurité' : 'Budget'} · {live ? 'à jour' : 'partiel'}
                </span>
              );
            })}
          </div>
        </section>

        {/* Gauge — existing component, unchanged, framed editorially */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
          <GaugeWithTooltip score={score} />
        </div>

        {/* 01 — Sous-scores */}
        <SectionLabel num="01" label="Sous-scores" meta="Pondéré" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 36 }}>
          {subScores.map((s) => {
            const v = score[s.key].value;
            const c = TIER[tierFromScore(v)].color;
            return (
              <div key={s.key} style={{ border: '1px solid var(--ctv3-line)', background: 'var(--ctv3-ink-850)', padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span className="ctv3-mono" style={{ fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ctv3-faint)' }}>
                    {s.lbl}
                  </span>
                  <span className="ctv3-mono" style={{ fontSize: 9, color: 'var(--ctv3-dim)', letterSpacing: '0.08em' }}>×{s.weight}%</span>
                </div>
                <div className="ctv3-mono" style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: c }}>
                  {v}<span style={{ color: 'var(--ctv3-faint)', fontSize: 15, marginLeft: 2, fontWeight: 500 }}>/100</span>
                </div>
                <div style={{ marginTop: 12, height: 4, background: 'var(--ctv3-ink-750)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: c, width: `${Math.max(0, Math.min(100, v))}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* 02 — Alerte MEAE */}
        <SectionLabel num="02" label="Alerte MEAE" meta="Officiel" />
        <div style={{
          display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14, alignItems: 'flex-start',
          border: '1px solid var(--ctv3-line)', borderLeft: `2px solid ${meaeColor}`,
          background: 'var(--ctv3-ink-850)', padding: '16px 18px', marginBottom: 20,
        }}>
          <div className="ctv3-mono" style={{
            width: 38, height: 38, display: 'grid', placeItems: 'center',
            border: `1px solid ${meaeColor}`, color: meaeColor, fontSize: 18, fontWeight: 700, flexShrink: 0,
          }}>
            {meae.ic}
          </div>
          <div>
            <div className="ctv3-mono" style={{
              fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--ctv3-faint)',
              textTransform: 'uppercase', marginBottom: 5, display: 'flex', justifyContent: 'space-between', gap: 8,
            }}>
              <span>MEAE · Niveau {meaeLevel}/4</span>
              <span>Intégré le {MEAE_LAST_UPDATED}</span>
            </div>
            <div style={{ fontFamily: 'var(--ctv3-display)', fontWeight: 800, fontSize: 15, marginBottom: 5, color: meaeColor }}>
              {meae.title}
            </div>
            <p className="ctv3-serif" style={{ color: 'var(--ctv3-muted)', fontSize: 14, lineHeight: 1.45 }}>{meae.desc}</p>
            <p className="ctv3-mono" style={{ color: 'var(--ctv3-faint)', fontSize: 11, marginTop: 8, lineHeight: 1.4 }}>
              Données intégrées — vérifiez la{' '}
              <a href={meaeOfficialUrl} target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--ctv3-faint)', textDecoration: 'underline' }}>
                source officielle Diplomatie.gouv
              </a>
              {' '}avant départ.
            </p>
          </div>
        </div>
        <div style={{ marginBottom: 36 }}>
          <SecurityAlert level={meaeLevel} country={score.country} />
        </div>

        {/* 03 — Budget réel (conditional, real values only) */}
        {budgetRows.length > 0 && (
          <>
            <SectionLabel num="03" label="Budget réel" meta="Estimé · 14 j" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 36 }}>
              {budgetRows.map((row, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                  border: '1px solid var(--ctv3-line)', background: 'var(--ctv3-ink-850)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ctv3-mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--ctv3-faint)', textTransform: 'uppercase', marginBottom: 3 }}>
                      {row.label}
                    </div>
                    <div className="ctv3-serif" style={{ color: 'var(--ctv3-muted)', fontSize: 13 }}>{row.sub}</div>
                  </div>
                  <div className="ctv3-mono" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ctv3-paper)', textAlign: 'right' }}>
                    {row.val}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 04 — Synthèse IA (PremiumGate preserved; honest neutral header) */}
        <SectionLabel num="04" label="Synthèse IA" meta="Analyse éditoriale" />
        <PremiumGate
          feature="Synthèse IA complète"
          description="Accédez à l'analyse narrative approfondie de Claude AI : contexte géopolitique, risques résiduels, recommandations personnalisées."
          isPremium={isPremium}
          isLoggedIn={!!user}
        >
          <div style={{ border: '1px solid var(--ctv3-line)', background: 'var(--ctv3-ink-850)', padding: '18px 20px', marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--ctv3-line-soft)' }}>
              <span className="ctv3-mono" style={{
                fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--ctv3-paper)',
              }}>
                Synthèse IA
              </span>
              <span className="ctv3-mono" style={{ marginLeft: 'auto', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ctv3-faint)' }}>
                Générée à partir des signaux disponibles
              </span>
            </div>
            <div className="ctv3-serif" style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ctv3-paper)', whiteSpace: 'pre-wrap' }}>
              {isPremium
                ? narrative
                : 'Analyse narrative approfondie : contexte géopolitique détaillé, risques résiduels et recommandations personnalisées. Réservé aux abonnés Premium.'}
            </div>
          </div>
        </PremiumGate>

        {/* Actions utilisateur (behavior unchanged) */}
        <div style={{
          display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
          padding: '4px 0 32px',
        }}>
          <AlertButton
            countryCode={score.countryCode}
            countryName={score.country}
            isLoggedIn={!!user}
          />
          <PremiumGate
            feature="Export PDF"
            description="Téléchargez le rapport complet au format PDF."
            isPremium={isPremium}
            isLoggedIn={!!user}
          >
            <a
              href={`/api/export-pdf/${score.countryCode}`}
              download
              className="ctv3-mono"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '11px 16px', border: '1px solid var(--ctv3-blue)', color: 'var(--ctv3-blue)',
                fontSize: 10.5, letterSpacing: '0.12em', fontWeight: 700,
                textDecoration: 'none', textTransform: 'uppercase',
              }}
            >
              ↓ Exporter en PDF
            </a>
          </PremiumGate>
        </div>

        {/* 05 — Historique */}
        <SectionLabel num="05" label="Historique" meta="6 mois" />
        <div style={{ marginBottom: 36 }}>
          <ScoreHistory countryCode={score.countryCode} countryName={score.country} />
        </div>

        {/* 06 — Pack Voyage (TravelPackBlock unchanged; contained by wrapper only) */}
        <SectionLabel num="06" label="Pack voyage" meta="Affiliés" />
        <TravelPackBlock
          countryCode={score.countryCode}
          countryName={score.country}
          mealCheapEur={score.budget.details.mealCheap ? Number(score.budget.details.mealCheap) : undefined}
          hotelAvgEur={score.budget.details.hotelAvg ? Number(score.budget.details.hotelAvg) : undefined}
        />

      </main>
    </div>
  );
}
