'use client';
import Link from 'next/link';
import { CrisisScoreGauge } from './CrisisScoreGauge';
import { getScoreColor } from '@/types/crisis.types';
import type { CrisisScore } from '@/types/crisis.types';

interface Props {
  score: CrisisScore;
}

// Mots-clés Unsplash par code pays pour une photo pertinente
const COUNTRY_PHOTO_KEYWORDS: Record<string, string> = {
  TH: 'Thailand,temple,Bangkok', GE: 'Georgia,Caucasus,Tbilisi', PT: 'Portugal,Lisbon,azulejo',
  MA: 'Morocco,Marrakech,medina', VN: 'Vietnam,Hanoi,rice',     MX: 'Mexico,city,culture',
  AL: 'Albania,Berat,mountains', RS: 'Serbia,Belgrade,city',    BA: 'Bosnia,Mostar,bridge',
  KG: 'Kyrgyzstan,mountains,nomad', MD: 'Moldova,vineyard,countryside', JP: 'Japan,Tokyo,cherry',
  ID: 'Bali,Indonesia,temple,rice', CO: 'Colombia,Bogota,coffee', PE: 'Peru,Machu-Picchu,Andes',
  TR: 'Turkey,Istanbul,Bosphorus', EG: 'Egypt,pyramids,desert', TN: 'Tunisia,desert,blue',
  MK: 'Macedonia,Ohrid,lake',    AM: 'Armenia,mountains,monastery', UZ: 'Uzbekistan,Samarkand,silk-road',
  KH: 'Cambodia,Angkor,temple',  LK: 'Sri-Lanka,beach,tea',   PH: 'Philippines,islands,sea',
  EC: 'Ecuador,Galapagos,volcano', ME: 'Montenegro,Kotor,Adriatic', XK: 'Kosovo,Pristina',
  GR: 'Greece,Santorini,island', HR: 'Croatia,Dubrovnik,sea', HU: 'Hungary,Budapest,parliament',
  SN: 'Senegal,Dakar,baobab',   CI: 'Ivory-Coast,Abidjan,lagoon', GH: 'Ghana,Accra,coast',
  KE: 'Kenya,savanna,safari',   TZ: 'Tanzania,Zanzibar,Kilimanjaro', RW: 'Rwanda,gorilla,green',
  ET: 'Ethiopia,Addis,landscape',ZA: 'South-Africa,Cape-Town,mountain', MU: 'Mauritius,lagoon,turquoise',
  MG: 'Madagascar,baobab,landscape', CM: 'Cameroon,landscape,mountain', CG: 'Congo,Brazzaville,river',
  CD: 'Congo,DRC,river,jungle', NG: 'Nigeria,Lagos,city',      AO: 'Angola,Luanda,coast',
  MY: 'Malaysia,Kuala-Lumpur,jungle', SG: 'Singapore,skyline,modern', MM: 'Myanmar,Bagan,temple',
  NP: 'Nepal,Himalaya,Everest', IN: 'India,Taj-Mahal,Rajasthan', KZ: 'Kazakhstan,steppe,Almaty',
  BO: 'Bolivia,Salar,Uyuni',    PY: 'Paraguay,Asuncion,landscape', UY: 'Uruguay,Montevideo,coast',
  GT: 'Guatemala,Maya,volcano', CR: 'Costa-Rica,jungle,waterfall', PA: 'Panama,canal,city',
  CU: 'Cuba,Havana,classic-car,colorful', DO: 'Dominican-Republic,Punta-Cana,beach',
  BR: 'Brazil,Rio,Christ',      AR: 'Argentina,Buenos-Aires,tango', CL: 'Chile,Patagonia,mountains',
  JO: 'Jordan,Petra,desert',    AE: 'Dubai,skyline,UAE',       OM: 'Oman,Muscat,desert',
};

function getPhotoUrl(code: string): string {
  const keywords = COUNTRY_PHOTO_KEYWORDS[code] ?? 'landscape,travel,mountains';
  return `https://source.unsplash.com/800x300/?${keywords}`;
}

export function CountryCard({ score }: Props) {
  const color = getScoreColor(score.total);
  const photoUrl = getPhotoUrl(score.countryCode);

  return (
    <Link href={`/destination/${score.countryCode}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        style={{
          position: 'relative', overflow: 'hidden',
          background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12,
          transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#3f3f5a';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#1e1e2e';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {/* Photo de fond */}
        <img
          src={photoUrl}
          alt={score.country}
          loading="lazy"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', opacity: 0.15, filter: 'blur(0.5px)',
          }}
        />
        {/* Overlay gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(19,19,26,0.95) 50%, rgba(19,19,26,0.7) 100%)',
        }} />

        {/* Contenu */}
        <div style={{ position: 'relative', padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'center' }}>
          <CrisisScoreGauge score={score.total} size="sm" showLabel={false} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#e8e8e8', marginBottom: 5 }}>
              {score.country}
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: '#6b7280' }}>
              <span>🛡 {score.security.value}</span>
              <span>🌐 {score.geopolitical.value}</span>
              <span>💶 {score.budget.value}</span>
            </div>
            {Number(score.budget.details.currencyVariation) > 10 ? (
              <div style={{ marginTop: 5, fontSize: '0.68rem', color: '#00e5a0', fontFamily: 'var(--font-space-mono)' }}>
                ✦ EUR +{score.budget.details.currencyVariation}% sur 12 mois
              </div>
            ) : null}
          </div>

          <div style={{
            fontSize: '0.65rem', letterSpacing: '0.08em', color,
            fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'var(--font-space-mono)',
            textAlign: 'right',
          }}>
            {score.status === 'ideal'        ? '🟢 IDÉALE'
            : score.status === 'recommended' ? '🟡 RECOMMANDÉE'
            : score.status === 'possible'    ? '🟠 POSSIBLE'
            :                                  '🔴 DÉCONSEILLÉE'}
          </div>
        </div>
      </div>
    </Link>
  );
}
