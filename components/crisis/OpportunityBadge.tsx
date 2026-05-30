'use client';

export type OpportunityType = 'currency' | 'security_improved' | 'cheap_flights' | 'jackpot';

interface Props {
  type: OpportunityType;
  explanation: string;
  estimatedSaving?: number;
  compact?: boolean;
}

const TYPE_CONFIG: Record<OpportunityType, {
  label: string;
  icon: string;
  bg: string;
  border: string;
  color: string;
  glow?: string;
}> = {
  jackpot: {
    label: 'JACKPOT',
    icon: '✨',
    bg: 'linear-gradient(135deg, rgba(255,178,36,0.15), rgba(255,140,66,0.08))',
    border: 'rgba(255,178,36,0.4)',
    color: '#ffb224',
    glow: '0 0 16px rgba(255,178,36,0.25)',
  },
  currency: {
    label: 'FX FAVORABLE',
    icon: '↯',
    bg: 'rgba(61,220,151,0.08)',
    border: 'rgba(61,220,151,0.3)',
    color: '#3ddc97',
  },
  cheap_flights: {
    label: 'VOLS PAS CHERS',
    icon: '✈',
    bg: 'rgba(74,158,255,0.08)',
    border: 'rgba(74,158,255,0.3)',
    color: '#4a9eff',
  },
  security_improved: {
    label: 'SÉCURITÉ EN HAUSSE',
    icon: '↑',
    bg: 'rgba(192,132,252,0.08)',
    border: 'rgba(192,132,252,0.3)',
    color: '#c084fc',
  },
};

export function OpportunityBadge({ type, explanation, estimatedSaving, compact = false }: Props) {
  const config = TYPE_CONFIG[type];

  if (compact) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 7px', borderRadius: 4,
        background: config.bg, border: `1px solid ${config.border}`,
        fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
        fontSize: '0.52rem', letterSpacing: '0.1em',
        color: config.color, fontWeight: 700,
        boxShadow: config.glow,
        whiteSpace: 'nowrap',
      }}>
        <span>{config.icon}</span>
        {config.label}
      </span>
    );
  }

  return (
    <div style={{
      borderRadius: 10, padding: '10px 14px',
      background: config.bg, border: `1px solid ${config.border}`,
      boxShadow: config.glow,
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      {/* Icon */}
      <div style={{
        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
        display: 'grid', placeItems: 'center',
        background: `${config.color}20`, color: config.color,
        fontSize: 13, fontWeight: 700,
      }}>
        {config.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Badge label */}
        <div style={{
          fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
          fontSize: '0.58rem', letterSpacing: '0.14em',
          textTransform: 'uppercase', color: config.color,
          fontWeight: 700, marginBottom: 3,
        }}>
          {config.label}
        </div>

        {/* Explanation */}
        <div style={{ fontSize: '0.78rem', color: '#c8c8da', lineHeight: 1.4 }}>
          {explanation}
        </div>

        {/* Saving */}
        {estimatedSaving && estimatedSaving > 0 && (
          <div style={{
            marginTop: 5,
            fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
            fontSize: '0.62rem', color: config.color, fontWeight: 700,
            letterSpacing: '0.04em',
          }}>
            ~{estimatedSaving}€ économisés
          </div>
        )}
      </div>
    </div>
  );
}
