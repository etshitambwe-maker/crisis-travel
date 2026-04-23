import Link from 'next/link';
import { CrisisScoreGauge } from './CrisisScoreGauge';
import { getScoreColor } from '@/types/crisis.types';
import type { CrisisScore } from '@/types/crisis.types';

interface Props {
  score: CrisisScore;
}

export function CountryCard({ score }: Props) {
  const color = getScoreColor(score.total);
  return (
    <Link href={`/destination/${score.countryCode}`} className="block">
      <div style={{
        background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12,
        padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'center',
        transition: 'border-color 0.2s',
      }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#3f3f5a')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1e1e2e')}
      >
        <CrisisScoreGauge score={score.total} size="sm" showLabel={false} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#e8e8e8', marginBottom: 4 }}>
            {score.country}
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: '#6b7280' }}>
            <span>🛡 {score.security.value}</span>
            <span>🌐 {score.geopolitical.value}</span>
            <span>💶 {score.budget.value}</span>
          </div>
          {Number(score.budget.details.currencyVariation) > 10 ? (
            <div style={{ marginTop: 6, fontSize: '0.7rem', color: '#00e5a0' }}>
              ✦ EUR +{score.budget.details.currencyVariation}% sur 12 mois
            </div>
          ) : null}
        </div>
        <div style={{ fontSize: '0.7rem', letterSpacing: '0.08em', color, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {score.status === 'ideal' ? '🟢 IDÉALE' :
           score.status === 'recommended' ? '🟡 RECOMMANDÉE' :
           score.status === 'possible' ? '🟠 POSSIBLE' : '🔴 DÉCONSEILLÉE'}
        </div>
      </div>
    </Link>
  );
}
