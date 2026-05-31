import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { GaugeWithTooltip } from '@/components/crisis/GaugeWithTooltip';
import { SecurityAlert } from '@/components/crisis/SecurityAlert';
import { TravelPackBlock } from '@/components/crisis/TravelPackBlock';
import { AlertButton } from '@/components/crisis/AlertButton';
import { ScoreHistory } from '@/components/crisis/ScoreHistory';
import { PremiumGate } from '@/components/auth/PremiumGate';
import { getScoreColor } from '@/types/crisis.types';
import type { CrisisScore } from '@/types/crisis.types';
import { calculateCrisisScore } from '@/lib/services/scoring/crisisScore.service';
import { generateDestinationNarrative } from '@/lib/claude/claude.service';
import { findCountry } from '@/lib/utils/countries';
import { getFlagUrlLarge, getCountryColors } from '@/lib/utils/countryPhoto';
import { getUserWithSubscription } from '@/lib/auth/supabase-server';

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
    description: `Analyse géopolitique et sécuritaire de ${c.name} pour les voyageurs français. Données officielles MEAE, budget estimé, alertes sécurité et synthèse IA en temps réel.`,
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
  1: { title: 'SURVEILLANCE NORMALE',           desc: "Aucune précaution particulière au-delà de la vigilance usuelle.", ic: '✓' },
  2: { title: 'VIGILANCE RENFORCÉE',            desc: 'Prendre des précautions supplémentaires dans certaines zones.',    ic: '!' },
  3: { title: 'DÉCONSEILLÉ SAUF IMPÉRATIF',    desc: "Ne s'y rendre que si un motif professionnel ou familial impératif l'exige.", ic: '⚠' },
  4: { title: 'FORMELLEMENT DÉCONSEILLÉ',      desc: 'Toute présence est fortement déconseillée, quel que soit le motif.', ic: '✕' },
};

const MEAE_STYLES: Record<number, { border: string; bg: string; icBg: string; icColor: string; titleColor: string }> = {
  1: { border: 'rgba(61,220,151,0.25)',  bg: 'linear-gradient(135deg, rgba(61,220,151,0.06), rgba(17,17,28,0.5))',  icBg: 'rgba(61,220,151,0.15)',  icColor: '#3ddc97', titleColor: '#3ddc97' },
  2: { border: 'rgba(255,178,36,0.25)',  bg: 'linear-gradient(135deg, rgba(255,178,36,0.06), rgba(17,17,28,0.5))',  icBg: 'rgba(255,178,36,0.15)',  icColor: '#ffb224', titleColor: '#ffb224' },
  3: { border: 'rgba(255,140,66,0.25)',  bg: 'linear-gradient(135deg, rgba(255,140,66,0.06), rgba(17,17,28,0.5))',  icBg: 'rgba(255,140,66,0.15)',  icColor: '#ff8c42', titleColor: '#ff8c42' },
  4: { border: 'rgba(255,59,47,0.25)',   bg: 'linear-gradient(135deg, rgba(255,59,47,0.06), rgba(17,17,28,0.5))',   icBg: 'rgba(255,59,47,0.15)',   icColor: '#ff3b2f', titleColor: '#ff3b2f' },
};

interface Props {
  params: Promise<{ country: string }>;
}

async function getData(code: string): Promise<{ score: CrisisScore; narrative: string; flagUrl: string; colors: [string, string] } | null> {
  const country = findCountry(code);
  if (!country) return null;
  try {
    const profile = { departureCountry: 'FR', budget: 1500, duration: 7, period: 'flexible', travelType: 'solo' as const, mode: 'standard' as const };
    const score = await calculateCrisisScore(country, profile);
    const narrative = await generateDestinationNarrative(score, profile);
    return { score, narrative, flagUrl: getFlagUrlLarge(code), colors: getCountryColors(code) };
  } catch {
    return null;
  }
}

function scoreColor(v: number) {
  if (v >= 80) return '#3ddc97';
  if (v >= 60) return '#ffb224';
  if (v >= 40) return '#ff8c42';
  return '#ff3b2f';
}

export default async function DestinationPage({ params }: Props) {
  const { country } = await params;
  const [data, { user, isPremium }] = await Promise.all([
    getData(country.toUpperCase()),
    getUserWithSubscription(),
  ]);

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', background: '#07070c' }}>
        <Header />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <p style={{ fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)', color: '#6b6b85', letterSpacing: '0.12em' }}>
            DESTINATION NON TROUVÉE
          </p>
        </div>
      </div>
    );
  }

  const { score, narrative, flagUrl, colors } = data;
  const meaeLevel = Math.min(4, Math.max(1, Number(score.security.details.meaeLevel ?? 2)));
  const meae = MEAE_DATA[meaeLevel];
  const meaeStyle = MEAE_STYLES[meaeLevel];
  const statusLabel = score.status === 'ideal' ? 'IDÉALE'
    : score.status === 'recommended' ? 'RECOMMANDÉE'
    : score.status === 'possible' ? 'POSSIBLE' : 'DÉCONSEILLÉE';

  const subScores = [
    { lbl: 'SÉCURITÉ',    val: score.security.value,     ic: '🛡', weight: '40%' },
    { lbl: 'GÉOPOLITIQUE', val: score.geopolitical.value, ic: '🌐', weight: '30%' },
    { lbl: 'BUDGET',      val: score.budget.value,        ic: '€',  weight: '20%' },
    { lbl: 'PRATICITÉ',   val: score.practicality.value,  ic: '☀',  weight: '10%' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#07070c' }}>
      <Header />

      {/* ── Hero : fond couleurs du pays + drapeau ─── */}
      <div style={{
        position: 'relative', width: '100%', minHeight: 220,
        background: `linear-gradient(135deg, ${colors[0]}40 0%, ${colors[1]}25 60%, #07070c 100%), #07070c`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '32px 20px 24px', gap: 16,
        borderBottom: '1px solid #1f1f30',
      }}>
        {/* Drapeau */}
        <img
          src={flagUrl}
          alt={`Drapeau ${score.country}`}
          style={{
            height: 90, width: 'auto', maxWidth: 160,
            objectFit: 'contain',
            filter: 'drop-shadow(0 6px 20px rgba(0,0,0,0.7))',
            borderRadius: 4,
          }}
        />
        {/* Nom + meta */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)', fontSize: 10, letterSpacing: '0.2em', color: '#9898b0', textTransform: 'uppercase', marginBottom: 6 }}>
            {country.toUpperCase()} · FICHE DESTINATION
          </div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-space-mono), monospace', fontSize: 'clamp(28px, 6vw, 42px)', fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1 }}>
            {score.country}
          </h1>
        </div>
        {/* Badges */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            background: 'rgba(7,7,12,0.7)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)', padding: '5px 10px', borderRadius: 6,
            fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)', fontSize: 10, letterSpacing: '0.14em',
            color: '#9898b0', textTransform: 'uppercase',
          }}>
            MAJ {new Date(score.calculatedAt).toLocaleDateString('fr-FR')}
          </div>
          <div style={{
            background: scoreColor(score.total), color: '#07070c',
            padding: '5px 10px', borderRadius: 6,
            fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)', fontSize: 10, letterSpacing: '0.14em',
            fontWeight: 700, textTransform: 'uppercase', boxShadow: `0 0 12px ${scoreColor(score.total)}66`,
          }}>
            {statusLabel}
          </div>
        </div>
      </div>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '0 20px 60px' }}>

        {/* Source badges + meta */}
        <div style={{ borderTop: '1px solid #1f1f30', padding: '16px 0 20px', borderBottom: '1px solid #1f1f30', marginBottom: 0 }}>
          {score.confidence === 'low' && (
            <div style={{ marginBottom: 10, fontSize: '0.75rem', color: '#ffb224', fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)' }}>
              ⚠ DONNÉES PARTIELLES — certaines sources étaient indisponibles
            </div>
          )}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {(['security', 'geopolitical', 'budget'] as const).map((key) => (
              <span key={key} style={{
                fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                fontSize: 8.5, letterSpacing: '0.16em',
                padding: '3px 7px', borderRadius: 3,
                textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 5,
                border: '1px solid #1f1f30', color: '#9898b0', fontWeight: 700,
                background: 'rgba(10,10,18,0.5)',
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%', display: 'inline-block',
                  background: score[key].source === 'live' ? '#3ddc97' : '#ffb224',
                  boxShadow: score[key].source === 'live' ? '0 0 5px #3ddc97' : 'none',
                }} />
                {key.toUpperCase()} {score[key].source === 'live' ? 'LIVE' : 'PARTIEL'}
              </span>
            ))}
          </div>
        </div>

        {/* Gauge */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 20px 20px', position: 'relative' }}>
          <div style={{
            position: 'absolute', top: 30, left: '50%', transform: 'translateX(-50%)',
            width: 200, height: 200,
            background: `radial-gradient(circle, ${scoreColor(score.total)}20, transparent 70%)`,
            pointerEvents: 'none',
          }} />
          <GaugeWithTooltip score={score} />
        </div>

        {/* Sous-scores */}
        <div style={{ marginBottom: 4 }}>
          <SectionHead num="01" label="SOUS-SCORES" meta="PONDÉRÉ" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 20 }}>
          {subScores.map((s) => (
            <div key={s.lbl} style={{
              background: 'rgba(17,17,28,0.7)', border: '1px solid #1f1f30',
              borderRadius: 12, padding: 14, position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{
                  fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                  fontSize: 9, letterSpacing: '0.16em', color: '#6b6b85',
                  textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ fontSize: 12 }}>{s.ic}</span> {s.lbl}
                </div>
                <span style={{
                  fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                  fontSize: 8, color: '#6b6b85', letterSpacing: '0.08em',
                }}>
                  ×{s.weight}
                </span>
              </div>
              <div style={{
                fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1,
                color: scoreColor(s.val),
              }}>
                {s.val}<span style={{ color: '#6b6b85', fontSize: 16, marginLeft: 2, fontWeight: 500 }}>/100</span>
              </div>
              <div style={{ marginTop: 12, height: 3, background: '#1f1f30', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, background: scoreColor(s.val), width: `${s.val}%`, transition: 'width 1s cubic-bezier(0.2,0.8,0.2,1)' }} />
              </div>
            </div>
          ))}
        </div>

        {/* MEAE alert */}
        <SectionHead num="02" label="ALERTE MEAE" meta="OFFICIEL" />
        <div style={{
          margin: '0 0 20px',
          borderRadius: 12, padding: '14px 16px',
          display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14, alignItems: 'flex-start',
          border: `1px solid ${meaeStyle.border}`, background: meaeStyle.bg,
        }}>
          <div style={{
            width: 38, height: 38, display: 'grid', placeItems: 'center',
            borderRadius: 8, background: meaeStyle.icBg, color: meaeStyle.icColor,
            fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)', fontSize: 18, fontWeight: 700,
            flexShrink: 0,
          }}>
            {meae.ic}
          </div>
          <div>
            <div style={{
              fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
              fontSize: 9, letterSpacing: '0.16em', color: '#6b6b85',
              textTransform: 'uppercase', marginBottom: 4,
              display: 'flex', justifyContent: 'space-between', gap: 8,
            }}>
              <span>MEAE · NIVEAU {meaeLevel}/4</span>
              <span>MAJ {new Date(score.calculatedAt).toLocaleDateString('fr-FR')}</span>
            </div>
            <div style={{
              fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
              fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
              fontWeight: 700, marginBottom: 4, lineHeight: 1.3, color: meaeStyle.titleColor,
            }}>
              {meae.title}
            </div>
            <div style={{ color: '#9898b0', fontSize: 12, lineHeight: 1.45 }}>{meae.desc}</div>
          </div>
        </div>

        {/* SecurityAlert legacy */}
        <div style={{ marginBottom: 20 }}>
          <SecurityAlert level={meaeLevel} country={score.country} />
        </div>

        {/* Budget sur place */}
        {(score.budget.details.mealCheap || score.budget.details.hotelAvg) && (
          <>
            <SectionHead num="03" label="BUDGET RÉEL" meta="ESTIMÉ 14J" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {[
                score.budget.details.mealCheap && {
                  ic: '🍽', label: 'REPAS BON MARCHÉ', sub: '~3 repas / jour',
                  val: `${score.budget.details.mealCheap}€`, icBg: 'rgba(255,178,36,0.1)', icColor: '#ffb224',
                },
                score.budget.details.hotelAvg && {
                  ic: '🛏', label: 'HÔTEL MOYEN × 14', sub: 'Médiane hôtel 3★',
                  val: `${(Number(score.budget.details.hotelAvg) * 14).toLocaleString('fr-FR')}€`, icBg: 'rgba(61,220,151,0.1)', icColor: '#3ddc97',
                },
                score.budget.details.currencyVariation !== undefined && {
                  ic: '↯', label: `IMPACT FX · ${score.countryCode}`,
                  sub: Number(score.budget.details.currencyVariation) > 5 ? 'AVANTAGEUX VS EUR' : 'NEUTRE',
                  val: `${Number(score.budget.details.currencyVariation) > 0 ? '+' : ''}${score.budget.details.currencyVariation}%`,
                  icBg: Number(score.budget.details.currencyVariation) > 5 ? 'rgba(61,220,151,0.15)' : 'rgba(107,107,133,0.15)',
                  icColor: Number(score.budget.details.currencyVariation) > 5 ? '#3ddc97' : '#9898b0',
                },
              ].filter(Boolean).map((row, i) => row && (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
                  background: 'rgba(17,17,28,0.6)', border: '1px solid #1f1f30', borderRadius: 10,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center',
                    background: row.icBg, color: row.icColor, flexShrink: 0, fontSize: 14,
                  }}>{row.ic}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)', fontSize: 9, letterSpacing: '0.15em', color: '#6b6b85', textTransform: 'uppercase', marginBottom: 2 }}>
                      {row.label}
                    </div>
                    <div style={{ color: '#9898b0', fontSize: 11, fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)', letterSpacing: '0.02em' }}>
                      {row.sub}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: '#f0f0f5', textAlign: 'right' }}>
                    {row.val}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* AI synthesis */}
        <SectionHead num="04" label="SYNTHÈSE IA" meta="CLAUDE SONNET" />
        <PremiumGate
          feature="Synthèse IA complète"
          description="Accédez à l'analyse narrative approfondie de Claude AI : contexte géopolitique, risques résiduels, recommandations personnalisées."
          isPremium={isPremium}
          isLoggedIn={!!user}
        >
          <div style={{
            background: 'rgba(17,17,28,0.7)', border: '1px solid #1f1f30',
            borderRadius: 14, padding: '16px 18px', marginBottom: 20,
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Top accent line */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 1,
              background: 'linear-gradient(90deg, transparent 0%, #ff3b2f 30%, #ff8c42 70%, transparent 100%)',
            }} />
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #1f1f30' }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'conic-gradient(from 45deg, #ff3b2f, #ff8c42, #ffb224, #ff3b2f)',
                display: 'grid', placeItems: 'center', position: 'relative',
              }}>
                <div style={{ position: 'absolute', inset: 3, background: '#0b0b14', borderRadius: '50%', display: 'grid', placeItems: 'center', zIndex: 1 }}>
                  <span style={{ fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)', fontSize: 8, fontWeight: 700, color: '#f0f0f5', letterSpacing: '-0.02em', position: 'relative', zIndex: 2 }}>AI</span>
                </div>
              </div>
              <div style={{ fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)', fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, color: '#f0f0f5' }}>
                SYNTHÈSE CLAUDE <span style={{ color: '#6b6b85', fontWeight: 500 }}>· SONNET 4.6</span>
              </div>
              <div style={{ marginLeft: 'auto', fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)', fontSize: 9, letterSpacing: '0.14em', color: '#3ddc97', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#3ddc97', boxShadow: '0 0 5px #3ddc97', display: 'inline-block' }} />
                TEMPS RÉEL
              </div>
            </div>
            {/* Body — la synthèse réelle ne quitte le serveur que pour les Premium.
                Pour les non-Premium, le PremiumGate floute déjà ; on n'envoie qu'un
                aperçu générique afin de ne pas exposer le contenu payant dans le HTML. */}
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#f0f0f5', whiteSpace: 'pre-wrap' }}>
              {isPremium
                ? narrative
                : 'Analyse narrative approfondie de Claude AI : contexte géopolitique détaillé, risques résiduels et recommandations personnalisées. Réservé aux abonnés Premium.'}
            </div>
          </div>
        </PremiumGate>

        {/* Actions utilisateur */}
        <div style={{
          display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
          padding: '16px 0', marginBottom: 8,
          borderTop: '1px solid #1f1f30',
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
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '9px 16px', borderRadius: 8,
                background: 'rgba(74,158,255,0.1)', border: '1px solid rgba(74,158,255,0.3)',
                color: '#4a9eff',
                fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                fontSize: '0.6rem', letterSpacing: '0.12em', fontWeight: 700,
                textDecoration: 'none', transition: 'all 0.2s',
              }}
            >
              ↓ EXPORTER PDF
            </a>
          </PremiumGate>
        </div>

        {/* Historique scores */}
        <SectionHead num="05" label="HISTORIQUE" meta="6 MOIS" />
        <div style={{ marginBottom: 20 }}>
          <ScoreHistory countryCode={score.countryCode} countryName={score.country} />
        </div>

        {/* Pack Voyage */}
        <SectionHead num="06" label="PACK VOYAGE" meta="AFFILIÉS" />
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

function SectionHead({ num, label, meta }: { num: string; label: string; meta: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #1f1f30',
    }}>
      <div style={{
        fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
        fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
        fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8, color: '#f0f0f5',
      }}>
        <span style={{ width: 8, height: 8, background: '#ff3b2f', transform: 'rotate(45deg)', display: 'inline-block' }} />
        <span style={{ color: '#6b6b85', fontWeight: 500 }}>{num} /</span>
        {label}
      </div>
      <span style={{ fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)', fontSize: 9.5, letterSpacing: '0.12em', color: '#6b6b85', textTransform: 'uppercase' }}>
        {meta}
      </span>
    </div>
  );
}
