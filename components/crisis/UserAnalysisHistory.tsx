'use client';
import { useEffect, useState } from 'react';
import type { UserAnalysis } from '@/types/crisis.types';
import { tierFromScore, TIER } from '@/components/design/atoms';

// ── Fonctions pures exportées pour les tests ─────────────────────────────────

export function buildDestinationUrl(opts: {
  countryCode: string;
  travelType?: string;
  duration?: number;
  budget?: number;
  mode?: string;
  /** TRAVEL-DATES-001 — Dates de voyage (YYYY-MM-DD), restaurées dans le lien Revoir. */
  departureDate?: string | null;
  returnDate?: string | null;
}): string {
  const params = new URLSearchParams();
  if (opts.travelType)     params.set('travelType', opts.travelType);
  if (opts.duration)       params.set('duration',   String(opts.duration));
  if (opts.budget)         params.set('budget',      String(opts.budget));
  if (opts.mode)           params.set('mode',        opts.mode);
  if (opts.departureDate)  params.set('from',        opts.departureDate);  // TRAVEL-DATES-001
  if (opts.returnDate)     params.set('to',          opts.returnDate);     // TRAVEL-DATES-001
  const qs = params.toString();
  return `/destination/${opts.countryCode.toLowerCase()}${qs ? `?${qs}` : ''}`;
}

export function formatAnalysisDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

// ── Labels ───────────────────────────────────────────────────────────────────

const TRAVEL_TYPE_LABEL: Record<string, string> = {
  solo:   'Solo',
  couple: 'Couple',
  family: 'Famille',
  nomad:  'Nomade',
};

const MODE_LABEL: Record<string, string> = {
  standard:      'Standard',
  bunker:        'Sécurité max',
  budget_crisis: 'Budget',
};

// ── Sous-composants internes ─────────────────────────────────────────────────

function Tag({ children, warn }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <span className="ctv3-mono" style={{
      fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
      padding: '3px 7px',
      border: `1px solid ${warn ? 'rgba(255,178,36,0.3)' : 'var(--ctv3-line)'}`,
      color: warn ? 'var(--ctv3-reco)' : 'var(--ctv3-faint)',
      background: warn ? 'rgba(255,178,36,0.06)' : 'transparent',
    }}>
      {children}
    </span>
  );
}

function SubScore({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? '#3ddc97' : value >= 60 ? '#ffb224' : value >= 40 ? '#ff8c42' : '#ff3b2f';
  return (
    <span className="ctv3-mono" style={{ fontSize: 9.5, color: 'var(--ctv3-faint)' }}>
      {label}{' '}
      <span style={{ color, fontWeight: 700 }}>{value}</span>
    </span>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export function UserAnalysisHistory() {
  const [analyses, setAnalyses] = useState<UserAnalysis[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);

  useEffect(() => {
    fetch('/api/user-analyses')
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((d) => {
        setAnalyses(d.analyses ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
        <div className="ct-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '24px 20px', border: '1px solid var(--ctv3-line)',
        background: 'var(--ctv3-ink-850)', textAlign: 'center',
      }}>
        <p className="ctv3-mono" style={{ fontSize: 11, color: 'var(--ctv3-reco)', letterSpacing: '0.1em' }}>
          IMPOSSIBLE DE CHARGER L&apos;HISTORIQUE — RÉESSAYEZ PLUS TARD
        </p>
      </div>
    );
  }

  if (!analyses.length) {
    return (
      <div style={{
        padding: '40px 24px', border: '1px solid var(--ctv3-line)',
        background: 'var(--ctv3-ink-850)', textAlign: 'center',
      }}>
        <p className="ctv3-mono" style={{
          fontSize: 10, color: 'var(--ctv3-faint)', letterSpacing: '0.14em', marginBottom: 8,
        }}>
          AUCUNE ANALYSE ENREGISTRÉE
        </p>
        <p className="ctv3-serif" style={{ fontSize: 14, color: 'var(--ctv3-muted)', lineHeight: 1.5 }}>
          Lancez une analyse depuis la page d&apos;accueil — elle apparaîtra ici automatiquement.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {analyses.map((a) => {
        const tier = tierFromScore(a.crisisScore);
        const tierInfo = TIER[tier];
        const destUrl = buildDestinationUrl({
          countryCode:   a.countryCode,
          travelType:    a.travelType,
          duration:      a.duration,
          budget:        a.budget,
          mode:          a.mode,
          departureDate: a.departureDate,  // TRAVEL-DATES-001
          returnDate:    a.returnDate,     // TRAVEL-DATES-001
        });

        return (
          <div
            key={a.id}
            style={{
              border: '1px solid var(--ctv3-line)',
              background: 'var(--ctv3-ink-850)',
              padding: '16px 18px',
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '12px 16px',
              alignItems: 'start',
            }}
          >
            {/* Colonne principale */}
            <div>
              {/* Score + pays */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span
                  className="ctv3-mono"
                  style={{ fontSize: 22, fontWeight: 700, color: tierInfo.color, letterSpacing: '-0.02em' }}
                >
                  {a.crisisScore}
                </span>
                <div>
                  <div style={{
                    fontFamily: 'var(--ctv3-display)', fontWeight: 800,
                    fontSize: 15, color: 'var(--ctv3-paper)', lineHeight: 1.1,
                  }}>
                    {a.countryName}
                  </div>
                  {a.status && (
                    <div className="ctv3-mono" style={{
                      fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
                      color: tierInfo.color, marginTop: 2,
                    }}>
                      {tierInfo.label}
                    </div>
                  )}
                </div>
              </div>

              {/* Profil voyage */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                {a.travelType && (
                  <Tag>{TRAVEL_TYPE_LABEL[a.travelType] ?? a.travelType}</Tag>
                )}
                {a.duration && <Tag>{a.duration} jours</Tag>}
                {a.budget && <Tag>{a.budget.toLocaleString('fr-FR')}€</Tag>}
                {a.mode && a.mode !== 'standard' && (
                  <Tag warn>{MODE_LABEL[a.mode] ?? a.mode}</Tag>
                )}
              </div>

              {/* TRAVEL-DATES-001 — dates de voyage si disponibles */}
              {a.departureDate && (
                <div style={{ marginTop: 5 }}>
                  <Tag>
                    {new Date(a.departureDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    {a.returnDate
                      ? ` → ${new Date(a.returnDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`
                      : ''}
                  </Tag>
                </div>
              )}

              {/* Sous-scores */}
              {(a.securityScore != null || a.geopoliticalScore != null || a.budgetScore != null) && (
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  {a.securityScore     != null && <SubScore label="SÉC" value={a.securityScore} />}
                  {a.geopoliticalScore != null && <SubScore label="GÉO" value={a.geopoliticalScore} />}
                  {a.budgetScore       != null && <SubScore label="BUD" value={a.budgetScore} />}
                </div>
              )}
            </div>

            {/* Colonne droite : date + lien */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
              <span className="ctv3-mono" style={{
                fontSize: 9.5, letterSpacing: '0.1em', color: 'var(--ctv3-faint)',
                whiteSpace: 'nowrap',
              }}>
                {formatAnalysisDate(a.analyzedAt)}
              </span>
              <a
                href={destUrl}
                className="ctv3-mono"
                style={{
                  padding: '6px 12px',
                  border: '1px solid var(--ctv3-line-bright)',
                  color: 'var(--ctv3-paper)',
                  fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase',
                  textDecoration: 'none', fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                Revoir →
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
