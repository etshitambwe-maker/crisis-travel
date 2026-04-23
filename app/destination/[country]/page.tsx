import { Header } from '@/components/layout/Header';
import { CrisisScoreGauge } from '@/components/crisis/CrisisScoreGauge';
import { SecurityAlert } from '@/components/crisis/SecurityAlert';
import { getScoreColor } from '@/types/crisis.types';
import type { CrisisScore } from '@/types/crisis.types';

interface Props {
  params: Promise<{ country: string }>;
}

async function getData(code: string): Promise<{ score: CrisisScore; narrative: string } | null> {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const res = await fetch(`${base}/api/destination/${code}/explain`, {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function DestinationPage({ params }: Props) {
  const { country } = await params;
  const data = await getData(country.toUpperCase());

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Header />
        <p style={{ color: '#6b7280' }}>Destination non trouvée ou analyse indisponible.</p>
      </div>
    );
  }

  const { score, narrative } = data;
  const meaeLevel = Number(score.security.details.meaeLevel ?? 2);

  const SubScoreBox = ({ label, value, weight }: { label: string; value: number; weight: string }) => (
    <div style={{ background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-space-mono)', fontSize: '1.8rem', fontWeight: 700, color: getScoreColor(value) }}>
        {value}
      </div>
      <div style={{ fontSize: '0.65rem', color: '#6b7280', letterSpacing: '0.08em', marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: '0.6rem', color: '#3f3f5a', marginTop: 1 }}>{weight}</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
      <Header />
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>

        {/* En-tête destination */}
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginBottom: 32 }}>
          <CrisisScoreGauge score={score.total} size="lg" />
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: 'var(--font-space-mono)', fontSize: '2.5rem', color: '#fff', marginBottom: 4 }}>
              {score.country}
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: 10 }}>
              Analyse du {new Date(score.calculatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <SecurityAlert level={meaeLevel} country={score.country} />
            {score.confidence === 'low' && (
              <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#ffd23f' }}>
                ⚠ Données partielles — certaines sources étaient indisponibles
              </div>
            )}
          </div>
        </div>

        {/* Sous-scores */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
          <SubScoreBox label="SÉCURITÉ" value={score.security.value} weight="40%" />
          <SubScoreBox label="GÉOPOLITIQUE" value={score.geopolitical.value} weight="30%" />
          <SubScoreBox label="BUDGET" value={score.budget.value} weight="20%" />
          <SubScoreBox label="PRATICITÉ" value={score.practicality.value} weight="10%" />
        </div>

        {/* Détails budget */}
        {(score.budget.details.mealCheap || score.budget.details.hotelAvg) && (
          <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '20px', marginBottom: 20 }}>
            <h2 style={{ fontFamily: 'var(--font-space-mono)', fontSize: '0.85rem', color: '#e8e8e8', letterSpacing: '0.1em', marginBottom: 14 }}>
              💶 BUDGET SUR PLACE
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: '0.85rem' }}>
              {score.budget.details.mealCheap && (
                <div>
                  <div style={{ color: '#6b7280', fontSize: '0.7rem', marginBottom: 2 }}>REPAS BON MARCHÉ</div>
                  <div style={{ color: '#e8e8e8', fontFamily: 'var(--font-space-mono)' }}>~{score.budget.details.mealCheap}€</div>
                </div>
              )}
              {score.budget.details.hotelAvg && (
                <div>
                  <div style={{ color: '#6b7280', fontSize: '0.7rem', marginBottom: 2 }}>HÔTEL MOYEN /NUIT</div>
                  <div style={{ color: '#e8e8e8', fontFamily: 'var(--font-space-mono)' }}>~{score.budget.details.hotelAvg}€</div>
                </div>
              )}
              {score.budget.details.currencyVariation !== undefined && (
                <div>
                  <div style={{ color: '#6b7280', fontSize: '0.7rem', marginBottom: 2 }}>TAUX DE CHANGE EUR</div>
                  <div style={{ color: Number(score.budget.details.currencyVariation) > 5 ? '#00e5a0' : '#e8e8e8', fontFamily: 'var(--font-space-mono)' }}>
                    {Number(score.budget.details.currencyVariation) > 0 ? '+' : ''}{score.budget.details.currencyVariation}% (12 mois)
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Analyse narrative Claude */}
        <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '24px' }}>
          <h2 style={{ fontFamily: 'var(--font-space-mono)', fontSize: '0.85rem', color: '#e8e8e8', letterSpacing: '0.1em', marginBottom: 16 }}>
            🤖 ANALYSE IA — CLAUDE SONNET
          </h2>
          <div style={{ color: '#c0c0c0', lineHeight: 1.7, fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
            {narrative}
          </div>
        </div>

        {/* Sources */}
        <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['security', 'geopolitical', 'budget'] as const).map((key) => (
            <span key={key} style={{
              fontSize: '0.65rem', color: score[key].source === 'live' ? '#00e5a0' : '#ffd23f',
              background: score[key].source === 'live' ? 'rgba(0,229,160,0.08)' : 'rgba(255,210,63,0.08)',
              border: `1px solid ${score[key].source === 'live' ? 'rgba(0,229,160,0.2)' : 'rgba(255,210,63,0.2)'}`,
              borderRadius: 4, padding: '3px 8px',
            }}>
              {key.toUpperCase()} {score[key].source === 'live' ? '✓ LIVE' : '⚠ PARTIEL'}
            </span>
          ))}
        </div>
      </main>
    </div>
  );
}
