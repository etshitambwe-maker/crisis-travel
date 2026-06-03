/**
 * FRONT-001 — Shared v3 design atoms (TypeScript/React)
 * ────────────────────────────────────────────────────────────────────────
 * Low-risk, presentational primitives ported from the design bundle for use
 * by later FRONT goals. All styling uses the --ctv3-* tokens (globals.css)
 * and is scoped under a `.ctv3` wrapper. No data fetching, no side effects.
 *
 * Exports: tier helpers, Eyebrow, SectionLabel, Chip, Button, VerdictScore,
 * Sparkline.
 */

import type { CSSProperties, ReactNode } from 'react';

/* ── Tier helpers (verdict tiers shared across the product) ─────────── */

export type TierKey = 'ideal' | 'reco' | 'poss' | 'deco';

export const TIER: Record<
  TierKey,
  { color: string; label: string; verdict: string }
> = {
  ideal: { color: 'var(--ctv3-ideal)', label: 'Idéale', verdict: 'Idéale actuellement' },
  reco: { color: 'var(--ctv3-reco)', label: 'Recommandée', verdict: 'Recommandée avec vigilance normale' },
  poss: { color: 'var(--ctv3-poss)', label: 'Possible', verdict: 'Possible avec préparation sérieuse' },
  deco: { color: 'var(--ctv3-deco)', label: 'Déconseillée', verdict: 'Fortement déconseillée actuellement' },
};

export function tierFromScore(v: number): TierKey {
  if (v >= 80) return 'ideal';
  if (v >= 60) return 'reco';
  if (v >= 40) return 'poss';
  return 'deco';
}

/* ── Eyebrow ────────────────────────────────────────────────────────── */

export function Eyebrow({
  children,
  red = false,
  style,
}: {
  children: ReactNode;
  red?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      className="ctv3-mono"
      style={{
        fontSize: 10,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: red ? 'var(--ctv3-red)' : 'var(--ctv3-faint)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        ...style,
      }}
    >
      <span style={{ width: 14, height: 1, background: 'currentColor', opacity: 0.5 }} />
      {children}
    </span>
  );
}

/* ── Section label ──────────────────────────────────────────────────── */

export function SectionLabel({
  num,
  label,
  meta,
}: {
  num?: ReactNode;
  label: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 0 12px',
        borderBottom: '1px solid var(--ctv3-line-soft)',
        marginBottom: 16,
      }}
    >
      <span
        className="ctv3-mono"
        style={{
          fontSize: 10,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ctv3-paper)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            background: 'var(--ctv3-red)',
            transform: 'rotate(45deg)',
          }}
        />
        {num != null && <span style={{ color: 'var(--ctv3-faint)', fontWeight: 500 }}>{num}</span>}
        {label}
      </span>
      {meta != null && (
        <span
          className="ctv3-mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--ctv3-faint)',
          }}
        >
          {meta}
        </span>
      )}
    </div>
  );
}

/* ── Chip (tier-aware) ──────────────────────────────────────────────── */

export function Chip({
  tier,
  children,
  solid = false,
  style,
}: {
  tier?: TierKey;
  children: ReactNode;
  solid?: boolean;
  style?: CSSProperties;
}) {
  const color = tier ? TIER[tier].color : 'var(--ctv3-muted)';
  return (
    <span
      className="ctv3-mono"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 10,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        padding: '5px 9px',
        border: `1px solid ${tier ? color : 'var(--ctv3-line)'}`,
        color,
        fontWeight: 500,
        background: solid ? 'var(--ctv3-ink-800)' : 'transparent',
        ...style,
      }}
    >
      {tier && <span style={{ width: 6, height: 6, background: color }} />}
      {children}
    </span>
  );
}

/* ── Button ─────────────────────────────────────────────────────────── */

export type ButtonVariant = 'primary' | 'ghost' | 'quiet';

const BTN_BASE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  fontFamily: 'var(--ctv3-display)',
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: '0.02em',
  padding: '14px 18px',
  border: '1px solid transparent',
  cursor: 'pointer',
  textTransform: 'uppercase',
};

const BTN_VARIANTS: Record<ButtonVariant, CSSProperties> = {
  primary: { background: 'var(--ctv3-red)', color: '#fff' },
  ghost: { background: 'transparent', borderColor: 'var(--ctv3-line)', color: 'var(--ctv3-paper)' },
  quiet: {
    background: 'var(--ctv3-ink-800)',
    borderColor: 'var(--ctv3-line-soft)',
    color: 'var(--ctv3-muted)',
    fontFamily: 'var(--ctv3-mono)',
    fontWeight: 500,
    fontSize: 11,
    textTransform: 'none',
    letterSpacing: '0.04em',
    padding: '11px 14px',
  },
};

export function Button({
  variant = 'primary',
  block = false,
  children,
  style,
  ...rest
}: {
  variant?: ButtonVariant;
  block?: boolean;
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      style={{ ...BTN_BASE, ...BTN_VARIANTS[variant], width: block ? '100%' : undefined, ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ── VerdictScore (ring + optional pillars) ─────────────────────────── */

export interface Pillar {
  label: string;
  value: number;
  weight: number;
}

export function VerdictScore({
  score = 76,
  pillars = [],
  confidence = 'élevée',
  sourceCount = 4,
  verdict,
  compact = false,
}: {
  score?: number;
  pillars?: Pillar[];
  confidence?: string;
  sourceCount?: number;
  verdict?: string;
  compact?: boolean;
}) {
  const t = TIER[tierFromScore(score)];
  const ringPct = Math.max(0, Math.min(100, score));
  const ringSize = compact ? 92 : 134;
  const inset = compact ? 7 : 10;
  return (
    <div
      style={{
        background: 'var(--ctv3-ink-850)',
        border: '1px solid var(--ctv3-line)',
        padding: compact ? 14 : 18,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
        <div
          style={{
            width: ringSize,
            height: ringSize,
            borderRadius: '50%',
            flexShrink: 0,
            background: `conic-gradient(${t.color} ${ringPct}%, var(--ctv3-ink-750) ${ringPct}% 100%)`,
            display: 'grid',
            placeItems: 'center',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset,
              background: 'var(--ctv3-ink-850)',
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div
                className="ctv3-mono"
                style={{
                  fontSize: compact ? 28 : 38,
                  fontWeight: 700,
                  color: t.color,
                  lineHeight: 1,
                  letterSpacing: '-0.04em',
                }}
              >
                {score}
              </div>
              <div
                className="ctv3-mono"
                style={{ fontSize: 9, color: 'var(--ctv3-faint)', letterSpacing: '0.16em', marginTop: 2 }}
              >
                / 100
              </div>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Chip tier={tierFromScore(score)}>{t.label}</Chip>
          <div
            className="ctv3-mono"
            style={{
              fontSize: 9,
              color: 'var(--ctv3-faint)',
              letterSpacing: '0.14em',
              marginTop: 7,
              textTransform: 'uppercase',
            }}
          >
            Confiance {confidence} · {sourceCount} sources
          </div>
          {verdict && !compact && (
            <p
              className="ctv3-serif"
              style={{ fontSize: 14, color: 'var(--ctv3-paper)', marginTop: 9, lineHeight: 1.45 }}
            >
              {verdict}
            </p>
          )}
        </div>
      </div>

      {pillars.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: compact ? 14 : 18 }}>
          {pillars.map((p, i) => (
            <div
              key={i}
              style={{ display: 'grid', gridTemplateColumns: '96px 1fr 58px', alignItems: 'center', gap: 10 }}
            >
              <span
                className="ctv3-mono"
                style={{ fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ctv3-muted)' }}
              >
                {p.label}
              </span>
              <span style={{ height: 4, background: 'var(--ctv3-ink-750)', position: 'relative', overflow: 'hidden' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${p.value}%`,
                    background: TIER[tierFromScore(p.value)].color,
                  }}
                />
              </span>
              <span
                className="ctv3-mono"
                style={{ fontSize: 11, textAlign: 'right', color: 'var(--ctv3-paper)', fontWeight: 500 }}
              >
                {p.value}
                <span style={{ fontSize: 9, color: 'var(--ctv3-faint)', marginLeft: 3 }}>×{p.weight}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Sparkline (tiny trend) ─────────────────────────────────────────── */

export function Sparkline({
  data = [62, 65, 64, 68, 70, 73, 76],
  w = 80,
  h = 22,
  color = 'var(--ctv3-reco)',
}: {
  data?: number[];
  w?: number;
  h?: number;
  color?: string;
}) {
  if (!data.length) return null;
  const min = Math.min(...data) - 2;
  const max = Math.max(...data) + 2;
  const stepX = w / (data.length - 1);
  const yFor = (v: number) => h - 2 - (h - 4) * ((v - min) / (max - min || 1));
  const d = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${yFor(v)}`).join(' ');
  const last = data[data.length - 1];
  return (
    <svg width={w} height={h} style={{ display: 'block' }} aria-hidden="true">
      <path d={`${d} L ${w} ${h} L 0 ${h} Z`} fill={color} opacity="0.16" />
      <path d={d} stroke={color} strokeWidth="1.2" fill="none" strokeLinejoin="round" />
      <circle cx={w - 0.5} cy={yFor(last)} r="2" fill={color} />
    </svg>
  );
}
