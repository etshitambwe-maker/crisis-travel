import { Header } from '@/components/layout/Header';
import { CrisisScoreGauge } from '@/components/crisis/CrisisScoreGauge';
import { SecurityAlert } from '@/components/crisis/SecurityAlert';
import { getScoreColor } from '@/types/crisis.types';
import type { CrisisScore } from '@/types/crisis.types';

const COUNTRY_PHOTO_KEYWORDS: Record<string, string> = {
  TH: 'Thailand,temple,Bangkok', GE: 'Georgia,Caucasus,Tbilisi', PT: 'Portugal,Lisbon,azulejo',
  MA: 'Morocco,Marrakech,medina', VN: 'Vietnam,Hanoi,rice', MX: 'Mexico,city,culture',
  AL: 'Albania,Berat,mountains', RS: 'Serbia,Belgrade,city', BA: 'Bosnia,Mostar,bridge',
  KG: 'Kyrgyzstan,mountains,nomad', MD: 'Moldova,vineyard', JP: 'Japan,Tokyo,cherry',
  ID: 'Bali,Indonesia,temple,rice', CO: 'Colombia,Bogota,coffee', PE: 'Peru,Machu-Picchu,Andes',
  TR: 'Turkey,Istanbul,Bosphorus', EG: 'Egypt,pyramids,desert', TN: 'Tunisia,desert,blue',
  MK: 'Macedonia,Ohrid,lake', AM: 'Armenia,mountains,monastery', UZ: 'Uzbekistan,Samarkand',
  KH: 'Cambodia,Angkor,temple', LK: 'Sri-Lanka,beach,tea', PH: 'Philippines,islands,sea',
  EC: 'Ecuador,Galapagos,volcano', ME: 'Montenegro,Kotor,Adriatic', GR: 'Greece,Santorini,island',
  HR: 'Croatia,Dubrovnik,sea', SN: 'Senegal,Dakar,baobab', KE: 'Kenya,savanna,safari',
  TZ: 'Tanzania,Zanzibar,Kilimanjaro', RW: 'Rwanda,gorilla,green', ZA: 'South-Africa,Cape-Town',
  MU: 'Mauritius,lagoon,turquoise', CG: 'Congo,Brazzaville,river', CD: 'Congo,river,jungle',
  JO: 'Jordan,Petra,desert', AE: 'Dubai,skyline,UAE', OM: 'Oman,Muscat,desert',
  IN: 'India,Taj-Mahal,Rajasthan', NP: 'Nepal,Himalaya,Everest', BR: 'Brazil,Rio,Christ',
  AR: 'Argentina,Buenos-Aires,tango', CL: 'Chile,Patagonia,mountains', CU: 'Cuba,Havana,colorful',
};

function getPhotoUrl(code: string): string {
  const kw = COUNTRY_PHOTO_KEYWORDS[code] ?? 'landscape,travel,mountains';
  return `https://source.unsplash.com/1200x400/?${kw}`;
}

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

  const photoUrl = getPhotoUrl(country.toUpperCase());
  const scoreColor = getScoreColor(score.total);
  const statusLabel = score.status === 'ideal' ? '🟢 IDÉALE'
    : score.status === 'recommended' ? '🟡 RECOMMANDÉE'
    : score.status === 'possible' ? '🟠 POSSIBLE' : '🔴 DÉCONSEILLÉE';

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
      <Header />

      {/* ── Bannière photo ──────────────────────────────── */}
      <div style={{ position: 'relative', height: 240, overflow: 'hidden' }}>
        <img
          src={photoUrl}
          alt={score.country}
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(1px)', transform: 'scale(1.05)' }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(10,10,15,0.2) 0%, rgba(10,10,15,0.97) 100%)',
        }} />
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 800, padding: '0 24px',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        }}>
          <div>
            <span style={{ fontFamily: 'var(--font-space-mono)', fontSize: '0.6rem', color: '#6b7280', letterSpacing: '0.12em', display: 'block', marginBottom: 4 }}>
              {country.toUpperCase()} · Analyse du {new Date(score.calculatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <h1 style={{ fontFamily: 'var(--font-space-mono)', fontSize: 'clamp(1.8rem,5vw,3rem)', color: '#fff', margin: 0, lineHeight: 1 }}>
              {score.country}
            </h1>
            <p style={{ fontFamily: 'var(--font-space-mono)', fontSize: '0.65rem', color: '#3f3f5a', margin: '4px 0 0', fontStyle: 'italic', letterSpacing: '0.08em' }}>
              À qui profite la crise
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-space-mono)', fontSize: '2.2rem', fontWeight: 700, color: scoreColor, lineHeight: 1 }}>
              {score.total}
            </div>
            <div style={{ fontSize: '0.65rem', color: scoreColor, fontFamily: 'var(--font-space-mono)', letterSpacing: '0.06em', marginTop: 2 }}>
              {statusLabel}
            </div>
          </div>
        </div>
      </div>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '28px 24px' }}>

        {/* En-tête destination */}
        <div style={{ marginBottom: 24 }}>
          <SecurityAlert level={meaeLevel} country={score.country} />
          {score.confidence === 'low' && (
            <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#ffd23f' }}>
              ⚠ Données partielles — certaines sources étaient indisponibles
            </div>
          )}
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
