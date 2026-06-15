'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { CrisisScore } from '@/types/crisis.types';
import { VISA_REQUIREMENTS } from '@/lib/data/visa-requirements';
import { DestinationImage } from '@/components/design/DestinationImage';
import { CountryFlag } from '@/components/design/CountryFlag';
import { Chip, tierFromScore, TIER } from '@/components/design/atoms';
import { getDestinationImagery } from '@/lib/design/destinationImagery';
import { ScoreTooltip } from './ScoreTooltip';

/**
 * FRONT-003 — Results card, premium travel-editorial direction.
 * ────────────────────────────────────────────────────────────────────────
 * Photo-led card built on the FRONT-001 toolkit. The real destination photo
 * (when available) is fetched from /api/photo/{code} and passed as `src` into
 * DestinationImage; on miss/error it falls back to the premium duotone — no
 * broken images, structurally (the <img> only mounts when src is set, and
 * onError clears it). The whole product flow is unchanged:
 *   - still a <Link> to /destination/{code}
 *   - still reads ONLY real payload values (total, sub-scores, status)
 *   - badges (JACKPOT FX / ULTRA-SAFE / SANS VISA) derive from real fields
 *
 * No scoring, no API, no fabricated metric. Tier is derived from `total`
 * via the shared atoms helper (handles the discouraged/dangerous enum without
 * relying on the brittle status string).
 */

interface Props {
  score: CrisisScore;
  /** TRIP-CONTEXT-001 — Query params à transmettre vers /destination pour la SSR profile-aware. */
  destinationParams?: string;
}

const PILLARS = [
  { label: 'Sécurité', key: 'security' as const },
  { label: 'Géopolitique', key: 'geopolitical' as const },
  { label: 'Budget', key: 'budget' as const },
  { label: 'Praticité', key: 'practicality' as const },
];

export function CountryCard({ score, destinationParams }: Props) {
  const ident = getDestinationImagery(score.countryCode);
  const tier = tierFromScore(score.total);
  const tierInfo = TIER[tier];
  const fxDelta = Number(score.budget.details.currencyVariation ?? 0);
  const visa = VISA_REQUIREMENTS[score.countryCode];
  const isJackpot = fxDelta > 15 && score.total >= 65;
  const isBunkerSafe = score.security.value >= 88;
  const noVisa = Boolean(visa && visa.type === 'none');

  // Real photo, fetched the same way as before. Fed into DestinationImage as
  // `src` → real photo when available, FRONT-001 duotone fallback otherwise.
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/photo/${score.countryCode}`)
      .then((r) => r.json())
      .then((d: { url?: string }) => {
        if (alive && d.url && /^https:\/\//.test(d.url)) setPhotoUrl(d.url);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [score.countryCode]);

  const fxLabel =
    fxDelta > 0 ? `Euro +${fxDelta.toFixed(0)}%`
    : fxDelta === 0 ? 'Zone euro'
    : `Euro ${fxDelta.toFixed(0)}%`;
  const fxColor = fxDelta > 10 ? 'var(--ctv3-ideal)' : fxDelta < -5 ? 'var(--ctv3-red)' : 'var(--ctv3-muted)';

  const destHref = destinationParams
    ? `/destination/${score.countryCode}?${destinationParams}`
    : `/destination/${score.countryCode}`;

  return (
    <Link
      href={destHref}
      className="ctv3-result-card"
      style={{ textDecoration: 'none', display: 'block', color: 'inherit' }}
    >
      <article
        style={{
          border: '1px solid var(--ctv3-line)',
          background: 'var(--ctv3-ink-850)',
          overflow: 'hidden',
          transition: 'border-color .2s, transform .2s, box-shadow .2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--ctv3-line-bright)';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.35)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--ctv3-line)';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {/* Hero — real photo (src) over FRONT-001 duotone fallback */}
        <DestinationImage
          code={score.countryCode}
          slot="hero"
          height={172}
          src={photoUrl}
          showLabel={false}
          scrim="strong"
        >
          {/* Verdict score badge — top right, with the existing breakdown tooltip */}
          <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 3 }}>
            <ScoreTooltip
              security={score.security.value}
              geopolitical={score.geopolitical.value}
              budget={score.budget.value}
              practicality={score.practicality.value}
              total={score.total}
            >
              <div
                className="ctv3-mono"
                style={{
                  display: 'inline-flex', alignItems: 'baseline', gap: 3,
                  padding: '5px 9px',
                  background: 'rgba(6,6,10,0.72)',
                  border: `1px solid ${tierInfo.color}`,
                  color: tierInfo.color,
                  fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em',
                  backdropFilter: 'blur(4px)',
                }}
              >
                {score.total}
                <span style={{ fontSize: 9, color: 'var(--ctv3-faint)', letterSpacing: '0.1em' }}>/100</span>
              </div>
            </ScoreTooltip>
          </div>

          {/* Name + flag + region — bottom left, over the strong scrim */}
          <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12, zIndex: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <CountryFlag code={score.countryCode} width={26} />
              <span
                style={{
                  fontFamily: 'var(--ctv3-display)', fontWeight: 800, fontSize: 21,
                  letterSpacing: '-0.02em', color: '#fff', lineHeight: 1,
                  textShadow: '0 1px 6px rgba(0,0,0,0.7)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {score.country}
              </span>
              <span
                className="ctv3-mono"
                style={{
                  marginLeft: 'auto', fontSize: 9, letterSpacing: '0.14em',
                  textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', flexShrink: 0,
                }}
              >
                {ident.region || score.countryCode}
              </span>
            </div>
          </div>
        </DestinationImage>

        {/* Body */}
        <div style={{ padding: '14px 16px 16px' }}>
          {/* Verdict line — editorial, derived from real total */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <Chip tier={tier} solid>{tierInfo.label}</Chip>
            <span
              className="ctv3-serif"
              style={{ fontSize: 13, color: 'var(--ctv3-muted)', lineHeight: 1.35 }}
            >
              {tierInfo.verdict}
            </span>
          </div>

          {/* Pillars — real sub-scores as compact editorial bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 }}>
            {PILLARS.map((p) => {
              const v = score[p.key].value;
              return (
                <div
                  key={p.key}
                  style={{ display: 'grid', gridTemplateColumns: '92px 1fr 34px', alignItems: 'center', gap: 10 }}
                >
                  <span
                    className="ctv3-mono"
                    style={{ fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ctv3-faint)' }}
                  >
                    {p.label}
                  </span>
                  <span style={{ height: 4, background: 'var(--ctv3-ink-750)', position: 'relative', overflow: 'hidden' }}>
                    <span
                      style={{
                        position: 'absolute', inset: 0, width: `${Math.max(0, Math.min(100, v))}%`,
                        background: TIER[tierFromScore(v)].color,
                      }}
                    />
                  </span>
                  <span
                    className="ctv3-mono"
                    style={{ fontSize: 11, textAlign: 'right', color: 'var(--ctv3-paper)', fontWeight: 500 }}
                  >
                    {v}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Real-data badges (unchanged logic) + FX line */}
          {(isJackpot || isBunkerSafe || noVisa) && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {isJackpot && <Chip tier="reco">✨ Jackpot FX</Chip>}
              {isBunkerSafe && <Chip tier="ideal">🛡 Ultra-sûre</Chip>}
              {noVisa && (
                <span
                  className="ctv3-mono"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10,
                    letterSpacing: '0.14em', textTransform: 'uppercase', padding: '5px 9px',
                    border: '1px solid var(--ctv3-blue)', color: 'var(--ctv3-blue)', fontWeight: 500,
                  }}
                >
                  ✓ Sans visa
                </span>
              )}
            </div>
          )}

          {/* Meta footer — score + FX + open hint */}
          <div
            className="ctv3-mono"
            style={{
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              fontSize: 10, letterSpacing: '0.04em', color: 'var(--ctv3-faint)',
              paddingTop: 11, borderTop: '1px solid var(--ctv3-line-soft)',
            }}
          >
            <span>Score <strong style={{ color: 'var(--ctv3-paper)' }}>{score.total}/100</strong></span>
            <span style={{ color: fxColor, fontWeight: fxDelta > 10 ? 700 : 500 }}>{fxLabel}</span>
            <span style={{ marginLeft: 'auto', color: 'var(--ctv3-red)', fontWeight: 500 }}>
              Voir le détail →
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
