'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getScoreColor } from '@/types/crisis.types';
import type { CrisisScore } from '@/types/crisis.types';
import { getFlagUrl, getCountryColors } from '@/lib/utils/countryPhoto';
import { ScoreTooltip } from './ScoreTooltip';
import { VISA_REQUIREMENTS } from '@/lib/data/visa-requirements';

interface Props {
  score: CrisisScore;
}

function scoreChipClass(v: number): string {
  if (v >= 80) return 'sc-good';
  if (v >= 60) return 'sc-mid';
  if (v >= 40) return 'sc-low';
  return 'sc-bad';
}

const STATUS_MAP: Record<string, { label: string; cls: string; color: string }> = {
  ideal:       { label: 'IDÉALE',       cls: 'ct-status-ideal', color: '#3ddc97' },
  recommended: { label: 'RECOMMANDÉE',  cls: 'ct-status-reco',  color: '#ffb224' },
  possible:    { label: 'POSSIBLE',     cls: 'ct-status-poss',  color: '#ff8c42' },
  dangerous:   { label: 'DÉCONSEILLÉE', cls: 'ct-status-deco',  color: '#ff3b2f' },
};

export function CountryCard({ score }: Props) {
  const flagUrl = getFlagUrl(score.countryCode);
  const [color1, color2] = getCountryColors(score.countryCode);
  const statusInfo = STATUS_MAP[score.status] ?? STATUS_MAP.possible;
  const totalColor = getScoreColor(score.total);
  const fxDelta = Number(score.budget.details.currencyVariation ?? 0);
  const visa = VISA_REQUIREMENTS[score.countryCode];
  const isJackpot = fxDelta > 15 && score.total >= 65;
  const isBunkerSafe = score.security.value >= 88;

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/photo/${score.countryCode}`)
      .then((r) => r.json())
      .then((d: { url?: string }) => {
        if (d.url && /^https:\/\//.test(d.url)) setPhotoUrl(d.url);
      })
      .catch(() => {});
  }, [score.countryCode]);

  return (
    <Link href={`/destination/${score.countryCode}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        style={{
          background: 'rgba(17,17,28,0.7)', backdropFilter: 'blur(12px)',
          border: '1px solid #1f1f30', borderRadius: 14,
          transition: 'all 0.2s ease', cursor: 'pointer',
          overflow: 'hidden', padding: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#2e2e45';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#1f1f30';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {/* Hero : photo destination + overlay lisibilité */}
        <div style={{
          position: 'relative', width: '100%', height: 200,
          overflow: 'hidden', borderRadius: '14px 14px 0 0',
          background: photoUrl
            ? `url(${photoUrl}) center/cover no-repeat, linear-gradient(135deg, ${color1}55 0%, ${color2}33 100%), #0d0d18`
            : `linear-gradient(135deg, ${color1}55 0%, ${color2}33 100%), #0d0d18`,
        }}>
          {/* Uniform dark overlay — improves legibility over any photo */}
          <div style={{
            position: 'absolute', inset: 0,
            background: photoUrl ? 'rgba(0,0,0,0.30)' : 'transparent',
            transition: 'background 0.4s ease',
          }} />

          {/* Bottom gradient — ensures name + flag readable regardless of photo */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 90,
            background: 'linear-gradient(0deg, rgba(7,7,12,0.92) 0%, rgba(7,7,12,0.4) 60%, transparent 100%)',
          }} />

          {/* Score badge — top right */}
          <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
            <ScoreTooltip
              security={score.security.value}
              geopolitical={score.geopolitical.value}
              budget={score.budget.value}
              practicality={score.practicality.value}
              total={score.total}
            >
              <div style={{
                background: totalColor, color: '#07070c',
                padding: '4px 8px', borderRadius: 4,
                fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                fontSize: 9, letterSpacing: '0.12em', fontWeight: 700,
              }}>
                {score.total}/100
              </div>
            </ScoreTooltip>
          </div>

          {/* Bottom row: flag badge (left) + country name + ISO code (right) */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2,
            padding: '0 12px 10px',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, minWidth: 0 }}>
              {/* Flag badge */}
              <img
                src={flagUrl}
                alt=""
                aria-hidden="true"
                style={{
                  height: 24, width: 'auto', maxWidth: 36,
                  objectFit: 'contain', flexShrink: 0,
                  filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.7))',
                  borderRadius: 2,
                }}
              />
              {/* Country name */}
              <div style={{
                fontSize: 18, fontWeight: 700, color: '#fff',
                letterSpacing: '-0.01em', lineHeight: 1,
                textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
              }}>
                {score.country}
              </div>
            </div>
            {/* ISO code */}
            <div style={{
              fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
              fontSize: 9, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.5)',
              flexShrink: 0,
            }}>
              {score.countryCode}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '14px 16px 16px' }}>
          {/* Score chips */}
          <div className="ct-score-chips" style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12,
          }}>
            {[
              { lbl: 'SÉC',  val: score.security.value },
              { lbl: 'GEO',  val: score.geopolitical.value },
              { lbl: 'BUD',  val: score.budget.value },
              { lbl: 'PRAT', val: score.practicality.value },
            ].map((chip) => (
              <div key={chip.lbl} style={{
                padding: '9px 6px', background: 'rgba(10,10,18,0.6)',
                border: '1px solid #1f1f30', borderRadius: 6, textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                  fontSize: 10, letterSpacing: '0.12em', color: '#6b6b85',
                  textTransform: 'uppercase', marginBottom: 2,
                }}>
                  {chip.lbl}
                </div>
                <div className={scoreChipClass(chip.val)} style={{
                  fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                  fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em',
                }}>
                  {chip.val}
                </div>
              </div>
            ))}
          </div>

          {/* Badges opportunité */}
          {(isJackpot || isBunkerSafe || (visa && visa.type === 'none')) && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
              {isJackpot && (
                <span style={{
                  padding: '2px 7px', borderRadius: 4,
                  background: 'linear-gradient(135deg, rgba(255,178,36,0.2), rgba(255,140,66,0.1))',
                  border: '1px solid rgba(255,178,36,0.4)', color: '#ffb224',
                  fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                  fontSize: '0.5rem', letterSpacing: '0.1em', fontWeight: 700,
                  boxShadow: '0 0 10px rgba(255,178,36,0.2)',
                }}>
                  ✨ JACKPOT FX
                </span>
              )}
              {isBunkerSafe && (
                <span style={{
                  padding: '2px 7px', borderRadius: 4,
                  background: 'rgba(61,220,151,0.12)', border: '1px solid rgba(61,220,151,0.3)',
                  color: '#3ddc97',
                  fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                  fontSize: '0.5rem', letterSpacing: '0.1em', fontWeight: 700,
                }}>
                  🛡 ULTRA-SAFE
                </span>
              )}
              {visa && visa.type === 'none' && (
                <span style={{
                  padding: '2px 7px', borderRadius: 4,
                  background: 'rgba(74,158,255,0.1)', border: '1px solid rgba(74,158,255,0.25)',
                  color: '#4a9eff',
                  fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                  fontSize: '0.5rem', letterSpacing: '0.1em', fontWeight: 700,
                }}>
                  ✓ SANS VISA
                </span>
              )}
            </div>
          )}

          {/* Meta row */}
          <div style={{
            display: 'flex', gap: 10, alignItems: 'center',
            fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
            fontSize: 10, color: '#9898b0', letterSpacing: '0.04em',
            paddingTop: 10, borderTop: '1px solid #1f1f30',
            flexWrap: 'wrap',
          }}>
            <span>
              SCORE <strong style={{ color: '#f0f0f5' }}>{score.total}/100</strong>
            </span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#2e2e45', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ color: fxDelta > 10 ? '#3ddc97' : fxDelta < -5 ? '#ff3b2f' : '#9898b0', fontWeight: fxDelta > 10 ? 700 : 400 }}>
              {fxDelta > 0 ? `EUR +${fxDelta.toFixed(0)}%` : fxDelta === 0 ? 'ZONE EURO' : `EUR ${fxDelta.toFixed(0)}%`}
            </span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#2e2e45', display: 'inline-block', flexShrink: 0 }} />
            <span className={statusInfo.cls} style={{
              fontSize: 8, padding: '2px 6px', borderRadius: 3,
              fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
              fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              {statusInfo.label}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
