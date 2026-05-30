'use client';
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface HistoryPoint {
  calculated_at: string;
  score: number;
  security_score: number;
  geopolitical_score: number;
  budget_score: number;
}

interface Props {
  countryCode: string;
  countryName: string;
}

function scoreColor(v: number): string {
  if (v >= 80) return '#3ddc97';
  if (v >= 60) return '#ffb224';
  if (v >= 40) return '#ff8c42';
  return '#ff3b2f';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as HistoryPoint;
  const color = scoreColor(d.score);
  return (
    <div style={{
      background: '#11111c', border: '1px solid #2e2e45',
      borderRadius: 8, padding: '10px 14px',
      fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
      fontSize: 10,
    }}>
      <div style={{ color: '#6b6b85', marginBottom: 6, letterSpacing: '0.1em' }}>
        {new Date(label).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
      </div>
      <div style={{ color, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
        {d.score}/100
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[
          { l: 'SÉC', v: d.security_score },
          { l: 'GÉO', v: d.geopolitical_score },
          { l: 'BUD', v: d.budget_score },
        ].map((s) => (
          <div key={s.l} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: '#6b6b85', width: 28 }}>{s.l}</span>
            <span style={{ color: scoreColor(s.v ?? 50) }}>{s.v ?? '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScoreHistory({ countryCode, countryName }: Props) {
  const [data, setData] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/score-history/${countryCode}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d.history ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [countryCode]);

  if (loading) {
    return (
      <div style={{
        height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(17,17,28,0.5)', borderRadius: 10, border: '1px solid #1f1f30',
      }}>
        <div className="ct-spinner" />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div style={{
        height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(17,17,28,0.5)', borderRadius: 10, border: '1px solid #1f1f30',
        fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
        fontSize: 10, color: '#3f3f5a', letterSpacing: '0.1em',
      }}>
        HISTORIQUE DISPONIBLE APRÈS 48H D'UTILISATION
      </div>
    );
  }

  const latest = data[data.length - 1]?.score ?? 50;
  const oldest = data[0]?.score ?? 50;
  const trend = latest - oldest;
  const trendColor = trend > 3 ? '#3ddc97' : trend < -3 ? '#ff3b2f' : '#9898b0';

  return (
    <div style={{
      background: 'rgba(17,17,28,0.6)', border: '1px solid #1f1f30',
      borderRadius: 12, padding: '14px 16px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 14,
      }}>
        <div style={{
          fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
          fontSize: 9, letterSpacing: '0.16em', color: '#6b6b85', textTransform: 'uppercase',
        }}>
          ÉVOLUTION CRISISCORE · {countryName.toUpperCase()} · {data.length}J
        </div>
        <div style={{
          fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
          fontSize: 11, fontWeight: 700,
          color: trendColor,
        }}>
          {trend > 0 ? `↑ +${trend}` : trend < 0 ? `↓ ${trend}` : '→ stable'}
        </div>
      </div>

      {/* Graphique */}
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <XAxis
            dataKey="calculated_at"
            tickFormatter={(v: string) => new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
            tick={{ fontSize: 8, fill: '#6b6b85', fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 8, fill: '#6b6b85', fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
            ticks={[0, 40, 60, 80, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* Zones de référence */}
          <ReferenceLine y={80} stroke="#3ddc97" strokeDasharray="3 3" strokeOpacity={0.3} />
          <ReferenceLine y={60} stroke="#ffb224" strokeDasharray="3 3" strokeOpacity={0.3} />
          <ReferenceLine y={40} stroke="#ff8c42" strokeDasharray="3 3" strokeOpacity={0.3} />
          {/* Ligne principale */}
          <Line
            type="monotone"
            dataKey="score"
            stroke={scoreColor(latest)}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: scoreColor(latest), strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
