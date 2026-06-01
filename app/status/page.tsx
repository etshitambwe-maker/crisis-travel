'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';

type ApiCheck = {
  name: string;
  status: 'ok' | 'down';
  latencyMs: number;
};

type HealthData = {
  status: 'healthy' | 'degraded';
  apis: ApiCheck[];
  checkedAt: string;
};

const SOURCE_META: Record<string, { label: string; description: string; category: string }> = {
  Frankfurter: {
    label: 'Taux de change en temps réel',
    description: 'Cours des devises utilisés pour estimer le pouvoir d\'achat dans chaque pays.',
    category: 'Sources économiques',
  },
  'World Bank': {
    label: 'Données économiques mondiales',
    description: 'Indicateurs de développement et de stabilité économique publiés par la Banque mondiale.',
    category: 'Sources économiques',
  },
  ReliefWeb: {
    label: 'Alertes humanitaires et crises',
    description: 'Rapports de situation sur les crises, catastrophes et instabilités régionales.',
    category: 'Sources géopolitiques',
  },
  FCDO: {
    label: 'Conseils officiels aux voyageurs',
    description: 'Recommandations gouvernementales sur la sécurité et les risques par destination.',
    category: 'Sources institutionnelles',
  },
};

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 8, height: 8, borderRadius: '50%',
      background: ok ? '#3ddc97' : '#ff4d2e',
      boxShadow: ok ? '0 0 6px #3ddc97' : '0 0 6px #ff4d2e',
      flexShrink: 0,
    }} />
  );
}

function SectionHead({ label, meta }: { label: string; meta?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #1f1f30',
    }}>
      <div style={{
        fontFamily: 'var(--font-space-mono), monospace',
        fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
        fontWeight: 700, color: '#f0f0f5',
        display: 'inline-flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ width: 8, height: 8, background: '#ff4d2e', transform: 'rotate(45deg)', display: 'inline-block' }} />
        {label}
      </div>
      {meta && (
        <span style={{
          fontFamily: 'var(--font-space-mono), monospace',
          fontSize: 9.5, color: '#6b6b85', letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          {meta}
        </span>
      )}
    </div>
  );
}

export default function StatusPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  function refresh() {
    setLoading(true);
    setFetchError(false);
    fetch('/api/health')
      .then((r) => r.json())
      .then((d: HealthData) => { setData(d); setLoading(false); })
      .catch(() => { setFetchError(true); setLoading(false); });
  }

  useEffect(() => { refresh(); }, []);

  const globalOk = data?.status === 'healthy';
  const okCount = data?.apis.filter((a) => a.status === 'ok').length ?? 0;
  const total = data?.apis.length ?? 0;

  return (
    <div style={{ minHeight: '100vh', background: '#07070c' }}>
      <Header />
      <main style={{ maxWidth: 700, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* ── En-tête ── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
            fontFamily: 'var(--font-space-mono), monospace',
            fontSize: 9.5, letterSpacing: '0.18em', color: '#6b6b85', textTransform: 'uppercase',
          }}>
            <span>ÉTAT DES SOURCES</span>
            <span style={{ width: 20, height: 1, background: '#2e2e45' }} />
            <span>TEMPS RÉEL</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <h1 style={{
              fontFamily: 'var(--font-space-mono), monospace',
              fontSize: 'clamp(26px, 6vw, 36px)', fontWeight: 700,
              letterSpacing: '-0.02em', color: '#f0f0f5', margin: 0, lineHeight: 1.1,
            }}>
              {loading ? 'VÉRIFICATION...' : globalOk ? 'SOURCES OPÉRATIONNELLES' : 'SOURCES PARTIELLEMENT DISPONIBLES'}
            </h1>

            {!loading && data && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 999,
                border: `1px solid ${globalOk ? 'rgba(61,220,151,0.3)' : 'rgba(255,212,63,0.3)'}`,
                background: globalOk ? 'rgba(61,220,151,0.06)' : 'rgba(255,212,63,0.06)',
                fontFamily: 'var(--font-space-mono), monospace',
                fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase',
                color: globalOk ? '#3ddc97' : '#ffd23f',
              }}>
                <StatusDot ok={globalOk} />
                {globalOk ? 'TOUT NOMINAL' : `${okCount}/${total} SOURCES ACTIVES`}
              </span>
            )}
          </div>

          {data && (
            <p style={{
              fontFamily: 'var(--font-space-mono), monospace',
              fontSize: 10, color: '#6b6b85', marginTop: 8, letterSpacing: '0.08em',
            }}>
              Vérifié le {new Date(data.checkedAt).toLocaleString('fr-FR', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              })}
            </p>
          )}
        </div>

        {/* ── Chapeau explicatif ── */}
        <div style={{
          background: 'rgba(74,158,255,0.04)', border: '1px solid rgba(74,158,255,0.12)',
          borderRadius: 12, padding: '18px 22px', marginBottom: 32,
        }}>
          <p style={{
            margin: 0, color: '#9898b0', fontSize: 14, lineHeight: 1.65,
            fontFamily: 'var(--font-dm-sans, sans-serif)',
          }}>
            Crisis Travel surveille en temps réel un ensemble de{' '}
            <strong style={{ color: '#c8c8d8', fontWeight: 600 }}>sources économiques, géopolitiques et institutionnelles</strong>{' '}
            pour fiabiliser chaque analyse de destination. Cette page indique si ces sources sont accessibles
            et opérationnelles au moment où vous consultez l'application.
          </p>
        </div>

        {/* ── Sources de données ── */}
        <section style={{ marginBottom: 28 }}>
          <SectionHead
            label="Sources de données"
            meta={data ? `${okCount}/${total} OPÉRATIONNELLES` : undefined}
          />

          {loading && (
            <div style={{
              padding: '40px', textAlign: 'center',
              fontFamily: 'var(--font-space-mono), monospace',
              fontSize: 11, color: '#6b6b85', letterSpacing: '0.14em',
            }}>
              VÉRIFICATION EN COURS...
            </div>
          )}

          {fetchError && (
            <div style={{
              background: 'rgba(255,77,46,0.08)', border: '1px solid rgba(255,77,46,0.25)',
              borderRadius: 10, padding: '16px 20px',
              fontFamily: 'var(--font-space-mono), monospace',
              fontSize: 12, color: '#ff4d2e',
            }}>
              Impossible de vérifier l'état des sources. Réessaie dans quelques secondes.
            </div>
          )}

          {data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.apis.map((api) => {
                const meta = SOURCE_META[api.name];
                const ok = api.status === 'ok';
                return (
                  <div key={api.name} style={{
                    background: '#0d0d14',
                    border: `1px solid ${ok ? '#1f1f30' : 'rgba(255,77,46,0.2)'}`,
                    borderRadius: 12, padding: '16px 20px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: meta ? 6 : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <StatusDot ok={ok} />
                        <span style={{
                          fontFamily: 'var(--font-space-mono), monospace',
                          fontSize: 13, fontWeight: 700, color: '#f0f0f5',
                        }}>
                          {meta?.label ?? api.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <span style={{
                          fontFamily: 'var(--font-space-mono), monospace',
                          fontSize: 10, color: '#4a4a6a', letterSpacing: '0.06em',
                        }}>
                          {api.latencyMs} ms
                        </span>
                        <span style={{
                          fontFamily: 'var(--font-space-mono), monospace',
                          fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase',
                          color: ok ? '#3ddc97' : '#ff4d2e',
                          background: ok ? 'rgba(61,220,151,0.08)' : 'rgba(255,77,46,0.08)',
                          border: `1px solid ${ok ? 'rgba(61,220,151,0.2)' : 'rgba(255,77,46,0.2)'}`,
                          borderRadius: 4, padding: '2px 8px',
                        }}>
                          {ok ? 'Disponible' : 'Indisponible'}
                        </span>
                      </div>
                    </div>
                    {meta?.description && (
                      <p style={{
                        margin: 0, marginLeft: 18,
                        fontSize: 12.5, color: '#6b6b85', lineHeight: 1.5,
                        fontFamily: 'var(--font-dm-sans, sans-serif)',
                      }}>
                        {meta.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Note indisponibilité ── */}
        {data && !globalOk && (
          <div style={{
            background: 'rgba(255,212,63,0.05)', border: '1px solid rgba(255,212,63,0.2)',
            borderRadius: 10, padding: '14px 20px', marginBottom: 28,
          }}>
            <p style={{
              margin: 0, fontSize: 13, color: '#c8a840', lineHeight: 1.55,
              fontFamily: 'var(--font-dm-sans, sans-serif)',
            }}>
              Certaines sources sont temporairement indisponibles. Les analyses restent actives
              et utilisent les données les plus récentes disponibles en cache.
            </p>
          </div>
        )}

        {/* ── Actions ── */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={refresh}
            disabled={loading}
            style={{
              padding: '10px 20px', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
              background: 'rgba(74,158,255,0.08)', border: '1px solid rgba(74,158,255,0.25)',
              color: '#4a9eff', fontFamily: 'var(--font-space-mono), monospace',
              fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
              opacity: loading ? 0.5 : 1, transition: 'all 0.2s',
            }}
          >
            {loading ? 'ACTUALISATION...' : '↻ ACTUALISER'}
          </button>
          <Link href="/#analyse" style={{
            padding: '10px 20px', borderRadius: 8, textDecoration: 'none',
            background: 'transparent', border: '1px solid #1f1f30',
            color: '#6b6b85', fontFamily: 'var(--font-space-mono), monospace',
            fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
            display: 'inline-block',
          }}>
            ← LANCER UNE ANALYSE
          </Link>
        </div>

      </main>
    </div>
  );
}
