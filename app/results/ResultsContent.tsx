'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CountryCard } from '@/components/crisis/CountryCard';
import { TravelPackMiniBlock } from '@/components/crisis/TravelPackMiniBlock';
import { ItineraryBlock } from '@/components/crisis/ItineraryBlock';
import { Eyebrow, SectionLabel, Chip } from '@/components/design/atoms';
import { getDestinationImagery } from '@/lib/design/destinationImagery';
import type { AnalyzeResponse, OpportunityWindow } from '@/types/crisis.types';

/**
 * FRONT-003 — Results page, premium travel-editorial direction.
 * ────────────────────────────────────────────────────────────────────────
 * Presentational redesign ONLY. The data flow is preserved verbatim:
 *   - same search params read, same `profile`, same POST /api/analyze body
 *   - same status handling (200/402/429/400/504/502/503/500/network)
 *   - same topDestinations vs results selection (continent ⇒ results)
 *   - same loading / error / empty / partial states
 *   - same TravelPackMiniBlock (rendered, never edited; visually contained
 *     only via the surrounding layout)
 * Only real payload values are displayed. No fabricated prices, dates, FX
 * deltas, source counts, or live metrics. Loading copy is neutral (no claim
 * of live source calls during the spinner).
 */

const CONTINENT_LABELS: Record<string, string> = {
  Europe: 'Europe',
  Africa: 'Afrique',
  Asia: 'Asie',
  Americas: 'Amériques',
  MiddleEast: 'Moyen-Orient',
};

const PRIORITY_LABELS: Record<string, { title: string; subtitle: string }> = {
  securite:   { title: 'Les destinations les plus sûres',  subtitle: 'Classées par score de sécurité décroissant' },
  budget:     { title: 'Les meilleures opportunités budget', subtitle: 'Où votre argent vaut le plus en ce moment' },
  decouverte: { title: 'Hors des sentiers battus',         subtitle: 'Des pays authentiques, moins touristiques' },
  tout:       { title: 'Vos destinations',                  subtitle: 'Le meilleur équilibre sécurité · budget · expérience' },
};

const SORT_LABELS: Record<string, string> = {
  security: 'triées par sécurité',
  budget:   'triées par budget',
  score:    'triées par CrisisScore',
};

export function ResultsContent() {
  const params = useSearchParams();
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorMeta, setErrorMeta] = useState<{ upgradeUrl?: string; retryAfter?: number; quotaUsed?: number; quotaLimit?: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const continent = params.get('continent') ?? undefined;
  const priority  = params.get('priority') ?? 'tout';
  const airport   = params.get('airport') ?? 'CDG';
  const sortByParam = params.get('mode') === 'bunker' ? 'security' : params.get('mode') === 'budget_crisis' ? 'budget' : 'score';
  const dateFrom  = params.get('from') ?? '';
  const dateTo    = params.get('to')   ?? '';

  // Timer affiché pendant le chargement
  useEffect(() => {
    if (!loading) return;
    const iv = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(iv);
  }, [loading]);

  useEffect(() => {
    const profile = {
      departureCountry: 'FR',
      budget: parseInt(params.get('budget') ?? '1500'),
      duration: parseInt(params.get('duration') ?? '7'),
      period: 'flexible',
      travelType: (params.get('travelType') ?? 'solo') as 'solo' | 'couple' | 'family' | 'nomad',
      mode: (params.get('mode') ?? 'standard') as 'standard' | 'bunker' | 'budget_crisis',
      continent,
      priority,
      sortBy: sortByParam as 'score' | 'security' | 'budget',
    };

    setLoading(true);
    setElapsed(0);
    setError(null);
    setErrorMeta(null);

    fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile }),
    })
      .then(async (r) => {
        // Lire le statut AVANT de parser : une 504 Vercel renvoie du HTML, pas du JSON.
        // On tente le JSON dans un try local pour ne pas confondre "réponse serveur
        // non-JSON" (timeout/504) avec une vraie coupure réseau (gérée par .catch).
        let json: Record<string, unknown> | null = null;
        try {
          json = await r.json();
        } catch {
          json = null; // réponse non-JSON (ex : page d'erreur 504/502 de Vercel)
        }

        if (r.ok && json) {
          setData(json as unknown as AnalyzeResponse);
          setLoading(false);
          return;
        }

        // À partir d'ici : erreur côté SERVEUR (on a bien reçu une réponse HTTP).
        const serverErr = (json?.error as string | undefined);
        if (r.status === 402) {
          const quotaData = json?.quota as { used?: number; limit?: number } | undefined;
          setError(serverErr ?? 'Quota mensuel atteint. Passez à Premium pour des analyses illimitées.');
          setErrorMeta({
            upgradeUrl: (json?.upgradeUrl as string) ?? '/pricing',
            quotaUsed: quotaData?.used,
            quotaLimit: quotaData?.limit,
          });
        } else if (r.status === 429) {
          const retryAfter = json?.retryAfter as number | undefined;
          const wait = retryAfter ? ` Réessayez dans ${Math.ceil(retryAfter / 60)} min.` : '';
          setError((serverErr ?? 'Limite de requêtes atteinte.') + wait);
          setErrorMeta({ retryAfter });
        } else if (r.status === 400) {
          setError('Paramètres invalides. Retournez à l\'accueil et relancez une analyse.');
        } else if (r.status === 504 || r.status === 502) {
          // Passerelle/timeout RÉEL : l'analyse a pris trop de temps côté serveur.
          // Rattaché au seul statut HTTP — une réponse non-JSON ne suffit plus à
          // déduire un timeout (un 503/500 amont est aussi non typé).
          setError('L\'analyse a pris trop de temps et n\'a pas pu aboutir. Réessayez dans quelques instants.');
        } else if (r.status === 503) {
          // Service amont indisponible (détecté par /api/analyze avant l'analyse).
          setError(serverErr ?? 'Le service d\'analyse est temporairement indisponible. Réessayez dans quelques instants.');
        } else {
          // 500 ou tout autre statut serveur, y compris réponse non-JSON inattendue.
          setError(serverErr ?? 'Erreur serveur. Réessayez dans quelques instants.');
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        // On n'a PAS reçu de réponse HTTP du tout → vraie défaillance réseau client.
        const isNetwork = err instanceof TypeError;
        setError(isNetwork
          ? 'Impossible de contacter le serveur. Vérifiez votre connexion.'
          : 'Une erreur inattendue s\'est produite. Réessayez dans quelques instants.');
        setLoading(false);
      });
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const labels = PRIORITY_LABELS[priority] ?? PRIORITY_LABELS.tout;
  const pageTitle = continent
    ? `Analyse ${CONTINENT_LABELS[continent] ?? continent}`
    : labels.title;
  const dateLabel = dateFrom
    ? ` · du ${new Date(dateFrom).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} au ${dateTo ? new Date(dateTo).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '?'}`
    : '';
  const pageSubtitle = continent
    ? `${data?.meta.analyzedCountries ?? '…'} pays analysés — ${SORT_LABELS[sortByParam] ?? ''} — depuis ${airport}${dateLabel}`
    : `${labels.subtitle} — depuis ${airport}${dateLabel}`;

  // Selection logic preserved exactly: continent ⇒ full results, else top picks.
  const ranked = data ? (continent ? data.results : data.topDestinations) : [];

  return (
    <div className="ctv3">
      <main style={{ maxWidth: 860, margin: '0 auto', padding: '0 20px 72px', position: 'relative' }}>
        {/* ── Editorial hero ─────────────────────────────────────────── */}
        <section style={{ padding: '34px 0 26px' }}>
          <Eyebrow red>Résultats de l’analyse</Eyebrow>
          <h1
            style={{
              fontFamily: 'var(--ctv3-display)', fontWeight: 900,
              fontSize: 'clamp(30px, 6.5vw, 46px)', lineHeight: 1.02,
              letterSpacing: '-0.035em', margin: '14px 0 12px', color: 'var(--ctv3-paper)',
            }}
          >
            {pageTitle}
          </h1>
          <p
            className="ctv3-serif"
            style={{ maxWidth: 520, color: 'var(--ctv3-muted)', fontSize: 16, lineHeight: 1.5, margin: 0 }}
          >
            {pageSubtitle}
          </p>

          {/* Honest meta strip — real payload values only, editorial framing */}
          {data && (
            <div
              className="ctv3-mono"
              style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 18,
                fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ctv3-faint)',
              }}
            >
              <span>{ranked.length} destination{ranked.length > 1 ? 's' : ''}</span>
              <span style={{ width: 16, height: 1, background: 'var(--ctv3-line)' }} />
              <span>{data.meta.analyzedCountries} pays analysés</span>
              {data.meta.partial && (
                <>
                  <span style={{ width: 16, height: 1, background: 'var(--ctv3-line)' }} />
                  <span style={{ color: 'var(--ctv3-reco)' }}>Résultats partiels</span>
                </>
              )}
            </div>
          )}

          {/* Bandeau quota — affiché seulement si meta.quota est présent (source Supabase fiable) */}
          {data?.meta.quota && !data.meta.quota.isPremium && (
            <div
              className="ctv3-mono"
              style={{
                marginTop: 12,
                padding: '9px 14px',
                border: `1px solid ${data.meta.quota.remaining === 0 ? 'var(--ctv3-red)' : 'var(--ctv3-line)'}`,
                background: data.meta.quota.remaining === 0 ? 'var(--ctv3-red-soft)' : 'var(--ctv3-ink-850)',
                fontSize: 10.5, letterSpacing: '0.08em',
                color: data.meta.quota.remaining === 0 ? 'var(--ctv3-red-2)' : 'var(--ctv3-muted)',
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              }}
            >
              {data.meta.quota.remaining > 0 ? (
                <span>
                  Il vous reste <strong style={{ color: 'var(--ctv3-paper)' }}>{data.meta.quota.remaining}</strong> analyse{data.meta.quota.remaining > 1 ? 's' : ''} gratuite{data.meta.quota.remaining > 1 ? 's' : ''} ce mois-ci.
                </span>
              ) : (
                <>
                  <span>Quota gratuit épuisé pour ce mois-ci.</span>
                  <a
                    href="/pricing"
                    style={{
                      color: 'var(--ctv3-red-2)', textDecoration: 'underline',
                      fontWeight: 700, letterSpacing: '0.1em',
                    }}
                  >
                    Passer à Premium →
                  </a>
                </>
              )}
            </div>
          )}
        </section>

        {/* ── Loading overlay — neutral copy, no live-source claim ────── */}
        {/* LOADING-UX-001 : loader CSS-only. L'ancienne « visual stage » image
            (asset PNG de ~1.9 MB) affichait un cadre noir le temps
            du téléchargement → impression de plantage. Remplacée par un anneau de scan
            ctv3 100 % CSS (langage ct021-* aligné sur app/results/loading.tsx), rendu
            instantanément. Overlay plein écran (.ct-overlay = fixed/inset:0), annoncé
            aux lecteurs d'écran via role=status + aria-live. Aucune image, aucune
            dépendance. La logique (loading/elapsed/progress/fetch/status) est inchangée. */}
        {loading && (
          <div className="ct-overlay" role="status" aria-live="polite" aria-busy="true">
            {/* Scoped keyframes — local to this component, no globals.css edit. */}
            <style>{`
              @keyframes ct017-spin { to { transform: rotate(360deg); } }
              @keyframes ct017-breathe { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
              @media (prefers-reduced-motion: reduce) {
                .ct017-spin-arc, .ct017-breathe-el, .ct017-spin-ring { animation: none !important; }
              }
            `}</style>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, width: '100%' }}>
              {/* Visual stage — pure-CSS scan ring (no asset). Rendu immédiat,
                  cohérent avec results/loading.tsx, plus de cadre noir. */}
              <div aria-hidden style={{ position: 'relative', width: 120, height: 120 }}>
                {/* Halo doux qui respire */}
                <div className="ct017-breathe-el" style={{
                  position: 'absolute', inset: -18, borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(91,141,239,0.20), transparent 70%)',
                  animation: 'ct017-breathe 3.2s ease-in-out infinite',
                }} />
                {/* Anneau pointillé externe en rotation lente */}
                <div className="ct017-spin-ring" style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: '1px dashed rgba(91,141,239,0.28)',
                  animation: 'ct017-spin 18s linear infinite reverse',
                }} />
                {/* Arc actif qui tourne — signal « travail en cours » */}
                <div className="ct017-spin-arc" style={{
                  position: 'absolute', inset: 12, borderRadius: '50%',
                  border: '2px solid transparent',
                  borderTopColor: 'var(--ctv3-blue)',
                  borderRightColor: 'rgba(91,141,239,0.35)',
                  animation: 'ct017-spin 1.15s linear infinite',
                  boxShadow: '0 0 24px rgba(91,141,239,0.18)',
                }} />
                {/* Cœur — losange ctv3 (langage de marque) */}
                <div className="ct017-breathe-el" style={{
                  position: 'absolute', top: '50%', left: '50%', width: 15, height: 15,
                  marginTop: -7.5, marginLeft: -7.5, background: 'var(--ctv3-blue)',
                  transform: 'rotate(45deg)', opacity: 0.9,
                  animation: 'ct017-breathe 2.4s ease-in-out infinite',
                }} />
              </div>

              <div style={{ textAlign: 'center', width: '100%', maxWidth: 340 }}>
                <div
                  className="ctv3-mono"
                  style={{ fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--ctv3-paper)', marginBottom: 10 }}
                >
                  Analyse en cours
                </div>

                {/* Deterministic progress bar (unchanged timing) */}
                {(() => {
                  const progress =
                    elapsed < 8  ? Math.round((elapsed / 8) * 30) :
                    elapsed < 18 ? Math.round(30 + ((elapsed - 8) / 10) * 35) :
                    elapsed < 28 ? Math.round(65 + ((elapsed - 18) / 10) * 23) :
                    Math.min(95, Math.round(88 + ((elapsed - 28) / 15) * 7));
                  return (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ height: 3, background: 'var(--ctv3-ink-750)', borderRadius: 999, overflow: 'hidden', width: '100%' }}>
                        <div style={{
                          height: '100%', borderRadius: 999, width: `${progress}%`,
                          background: 'linear-gradient(90deg, var(--ctv3-blue), var(--ctv3-ideal))',
                          transition: 'width 0.9s ease',
                        }} />
                      </div>
                      <div
                        className="ctv3-mono"
                        style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 9, color: 'var(--ctv3-dim)', letterSpacing: '0.08em' }}
                      >
                        <span>{progress}%</span>
                        <span>{elapsed}s · jusqu&apos;à 35s selon le cache</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Step text — neutral, no implied live source calls */}
                <div
                  className="ctv3-mono"
                  style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--ctv3-faint)', minHeight: 16 }}
                >
                  {elapsed < 8  ? 'Préparation de l’analyse…' :
                   elapsed < 18 ? 'Croisement des signaux disponibles…' :
                   elapsed < 28 ? 'Classement des destinations…' :
                                  'Construction des recommandations…'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Error state ────────────────────────────────────────────── */}
        {error && (
          <div style={{ background: 'var(--ctv3-red-soft)', border: '1px solid var(--ctv3-red)', padding: '20px 24px' }}>
            <div
              className="ctv3-mono"
              style={{ color: 'var(--ctv3-red-2)', fontSize: 13, lineHeight: 1.5, marginBottom: errorMeta ? 14 : 0 }}
            >
              {error}
            </div>
            {/* Détail quota 402 — affiché seulement si données fiables issues du body API */}
            {errorMeta?.quotaUsed !== undefined && errorMeta?.quotaLimit !== undefined && (
              <div className="ctv3-mono" style={{ fontSize: 10.5, color: 'var(--ctv3-muted)', marginTop: 6, marginBottom: 8 }}>
                {errorMeta.quotaUsed}/{errorMeta.quotaLimit} analyses utilisées ce mois-ci.
              </div>
            )}
            {errorMeta?.upgradeUrl ? (
              <a
                href={errorMeta.upgradeUrl}
                className="ctv3-mono"
                style={{
                  display: 'inline-block', marginTop: 4, padding: '9px 18px',
                  background: 'var(--ctv3-red)', color: '#fff', fontSize: 11,
                  letterSpacing: '0.12em', textDecoration: 'none', textTransform: 'uppercase', fontWeight: 700,
                }}
              >
                Passer à Premium — analyses illimitées →
              </a>
            ) : (
              <a
                href="/"
                className="ctv3-mono"
                style={{
                  display: 'inline-block', marginTop: 4, padding: '9px 18px',
                  border: '1px solid var(--ctv3-red)', color: 'var(--ctv3-red-2)', fontSize: 11,
                  letterSpacing: '0.12em', textDecoration: 'none', textTransform: 'uppercase', fontWeight: 700,
                }}
              >
                ← Retour à l’accueil
              </a>
            )}
          </div>
        )}

        {/* ── Data ───────────────────────────────────────────────────── */}
        {data && (
          <>
            {/* Empty state — honest editorial fallback, no fabricated content */}
            {ranked.length === 0 && data.opportunities.length === 0 && (
              <div style={{ border: '1px solid var(--ctv3-line)', background: 'var(--ctv3-ink-850)', padding: '28px 24px', textAlign: 'center' }}>
                <p className="ctv3-serif" style={{ fontSize: 16, color: 'var(--ctv3-paper)', marginBottom: 8 }}>
                  Aucune destination ne ressort pour ces critères.
                </p>
                <p className="ctv3-serif" style={{ fontSize: 14, color: 'var(--ctv3-muted)', marginBottom: 18 }}>
                  Élargissez la période, le budget ou la région, puis relancez une analyse.
                </p>
                <a
                  href="/"
                  className="ctv3-mono"
                  style={{
                    display: 'inline-block', padding: '10px 18px', border: '1px solid var(--ctv3-line-bright)',
                    color: 'var(--ctv3-paper)', fontSize: 11, letterSpacing: '0.12em',
                    textDecoration: 'none', textTransform: 'uppercase',
                  }}
                >
                  ← Nouvelle recherche
                </a>
              </div>
            )}

            {/* Opportunités — real OpportunityWindow data only, restyled */}
            {data.opportunities.length > 0 && (
              <div style={{ marginBottom: 34 }}>
                <SectionLabel num="01" label="Fenêtres d’opportunité" meta={`${data.opportunities.length} détectée${data.opportunities.length > 1 ? 's' : ''}`} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.opportunities.map((op: OpportunityWindow, i: number) => {
                    const ident = getDestinationImagery(op.countryCode);
                    return (
                      <div
                        key={i}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 14,
                          border: '1px solid var(--ctv3-line)', borderLeft: '2px solid var(--ctv3-ideal)',
                          background: 'var(--ctv3-ink-850)', padding: '13px 16px',
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                            <span style={{ fontFamily: 'var(--ctv3-display)', fontWeight: 800, fontSize: 14, color: 'var(--ctv3-paper)' }}>
                              {op.country ?? ident.name ?? op.countryCode}
                            </span>
                            {op.estimatedSaving > 0 && (
                              <Chip tier="ideal">~{op.estimatedSaving}€ économisés</Chip>
                            )}
                          </div>
                          <p className="ctv3-serif" style={{ fontSize: 13.5, color: 'var(--ctv3-muted)', lineHeight: 1.45 }}>
                            {op.explanation}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Destination ranking */}
            {ranked.length > 0 && (
              <>
                <SectionLabel
                  num={data.opportunities.length > 0 ? '02' : '01'}
                  label={continent ? `Destinations · ${CONTINENT_LABELS[continent] ?? continent}` : ranked.length > 5 ? 'Toutes les destinations' : 'Meilleures destinations'}
                  meta={`${ranked.length} parmi ${data.meta.analyzedCountries} analysés`}
                />
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: 16,
                  }}
                >
                  {ranked.map((score) => (
                    <CountryCard key={score.countryCode} score={score} />
                  ))}
                </div>

                {!continent && data.results.length > 5 && (
                  <p
                    className="ctv3-mono"
                    style={{ marginTop: 18, fontSize: 10, color: 'var(--ctv3-faint)', textAlign: 'center', letterSpacing: '0.1em', textTransform: 'uppercase' }}
                  >
                    {data.results.length - 5} autres destinations analysées · lancez une analyse par région pour tout voir
                  </p>
                )}
              </>
            )}

            {/* Pack Voyage affiliation — TravelPackMiniBlock unchanged, only
                visually contained by this wrapper (max width + spacing). */}
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
              {(() => {
                const top = ranked[0];
                return (
                  <TravelPackMiniBlock
                    countryCode={top?.countryCode}
                    countryName={top?.country}
                    travelType={(params.get('travelType') ?? 'solo') as 'solo' | 'couple' | 'family' | 'nomad'}
                    checkin={dateFrom || undefined}
                    checkout={dateTo || undefined}
                  />
                );
              })()}
            </div>

            {/* Itinéraire IA premium — ITINERARY-003.
                Rendu uniquement quand une destination top est disponible.
                Aucun appel API automatique au chargement — génération à la demande uniquement. */}
            {ranked[0] && (
              <div style={{ maxWidth: 640, margin: '0 auto' }}>
                <ItineraryBlock
                  countryCode={ranked[0].countryCode}
                  countryName={ranked[0].country}
                  dateFrom={dateFrom || undefined}
                  dateTo={dateTo || undefined}
                  budget={parseInt(params.get('budget') ?? '0') || undefined}
                  travelers={
                    (() => {
                      const tt = (params.get('travelType') ?? 'solo') as 'solo' | 'couple' | 'family' | 'nomad';
                      return tt === 'couple' || tt === 'family' ? 2 : 1;
                    })()
                  }
                  travelType={(params.get('travelType') ?? 'solo') as 'solo' | 'couple' | 'family' | 'nomad'}
                  meaeLevel={
                    (() => {
                      const lvl = ranked[0].security?.details?.meaeLevel;
                      const n = typeof lvl === 'number' ? lvl : parseInt(String(lvl ?? '1'));
                      return ([1, 2, 3, 4].includes(n) ? n : 1) as 1 | 2 | 3 | 4;
                    })()
                  }
                />
              </div>
            )}

            {/* CTA Nouvelle analyse — toujours visible après résultats */}
            <div style={{ marginTop: 40, textAlign: 'center', borderTop: '1px solid var(--ctv3-line)', paddingTop: 32 }}>
              <p className="ctv3-serif" style={{ color: 'var(--ctv3-muted)', fontSize: 14, marginBottom: 16 }}>
                Vous souhaitez affiner vos critères ou explorer une autre région ?
              </p>
              <a
                href="/"
                className="ctv3-mono"
                style={{
                  display: 'inline-block', padding: '11px 24px',
                  border: '1px solid var(--ctv3-line-bright)',
                  color: 'var(--ctv3-paper)', fontSize: 11,
                  letterSpacing: '0.14em', textDecoration: 'none', textTransform: 'uppercase', fontWeight: 700,
                }}
              >
                ← Nouvelle analyse
              </a>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
