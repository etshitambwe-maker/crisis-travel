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
  env: Record<string, boolean>;
  checkedAt: string;
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

export default function StatusPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function refresh() {
    setLoading(true);
    setError(false);
    fetch('/api/health')
      .then((r) => r.json())
      .then((d: HealthData) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }

  useEffect(() => { refresh(); }, []);

  const globalOk = data?.status === 'healthy';

  return (
    <div style={{ minHeight: '100vh', background: '#07070c' }}>
      <Header />
      <main style={{ maxWidth: 700, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* En-tête */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
            fontFamily: 'var(--font-space-mono), monospace',
            fontSize: 9.5, letterSpacing: '0.18em', color: '#6b6b85', textTransform: 'uppercase',
          }}>
            <span>SYSTÈME</span>
            <span style={{ width: 20, height: 1, background: '#2e2e45' }} />
            <span>STATUT EN TEMPS RÉEL</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <h1 style={{
              fontFamily: 'var(--font-space-mono), monospace',
              fontSize: 'clamp(28px, 7vw, 38px)', fontWeight: 700,
              letterSpacing: '-0.02em', color: '#f0f0f5', margin: 0,
            }}>
              {loading ? 'VÉRIFICATION...' : globalOk ? 'TOUS SYSTÈMES OK' : 'DÉGRADÉ'}
            </h1>
            {!loading && data && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 999,
                border: `1px solid ${globalOk ? 'rgba(61,220,151,0.3)' : 'rgba(255,77,46,0.3)'}`,
                background: globalOk ? 'rgba(61,220,151,0.06)' : 'rgba(255,77,46,0.06)',
                fontFamily: 'var(--font-space-mono), monospace',
                fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase',
                color: globalOk ? '#3ddc97' : '#ff4d2e',
              }}>
                <StatusDot ok={globalOk} />
                {globalOk ? 'HEALTHY' : 'DEGRADED'}
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

        {/* État APIs externes */}
        <section style={{ marginBottom: 28 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #1f1f30',
          }}>
            <div style={{
              fontFamily: 'var(--font-space-mono), monospace',
              fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
              fontWeight: 700, color: '#f0f0f5', display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ width: 8, height: 8, background: '#ff4d2e', transform: 'rotate(45deg)', display: 'inline-block' }} />
              APIS EXTERNES
            </div>
            <span style={{
              fontFamily: 'var(--font-space-mono), monospace',
              fontSize: 9.5, color: '#6b6b85', letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              {data ? `${data.apis.filter((a) => a.status === 'ok').length}/${data.apis.length} OK` : '—'}
            </span>
          </div>

          {loading && (
            <div style={{
              padding: '32px', textAlign: 'center',
              fontFamily: 'var(--font-space-mono), monospace',
              fontSize: 11, color: '#6b6b85', letterSpacing: '0.14em',
            }}>
              INTERROGATION DES APIS...
            </div>
          )}

          {error && (
            <div style={{
              background: 'rgba(255,77,46,0.08)', border: '1px solid rgba(255,77,46,0.25)',
              borderRadius: 10, padding: '16px 20px',
              fontFamily: 'var(--font-space-mono), monospace',
              fontSize: 12, color: '#ff4d2e',
            }}>
              Impossible de contacter /api/health. Réessaie dans quelques secondes.
            </div>
          )}

          {data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.apis.map((api) => (
                <div key={api.name} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#0d0d14', border: `1px solid ${api.status === 'ok' ? '#1f1f30' : 'rgba(255,77,46,0.2)'}`,
                  borderRadius: 10, padding: '14px 18px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <StatusDot ok={api.status === 'ok'} />
                    <span style={{
                      fontFamily: 'var(--font-space-mono), monospace',
                      fontSize: 13, fontWeight: 600, color: '#f0f0f5',
                    }}>
                      {api.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{
                      fontFamily: 'var(--font-space-mono), monospace',
                      fontSize: 11, color: '#6b6b85', letterSpacing: '0.06em',
                    }}>
                      {api.latencyMs} ms
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-space-mono), monospace',
                      fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
                      color: api.status === 'ok' ? '#3ddc97' : '#ff4d2e',
                      background: api.status === 'ok' ? 'rgba(61,220,151,0.08)' : 'rgba(255,77,46,0.08)',
                      border: `1px solid ${api.status === 'ok' ? 'rgba(61,220,151,0.2)' : 'rgba(255,77,46,0.2)'}`,
                      borderRadius: 4, padding: '2px 8px',
                    }}>
                      {api.status === 'ok' ? 'OK' : 'DOWN'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Variables d'environnement */}
        {data && (
          <section style={{ marginBottom: 28 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #1f1f30',
            }}>
              <div style={{
                fontFamily: 'var(--font-space-mono), monospace',
                fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
                fontWeight: 700, color: '#f0f0f5', display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ width: 8, height: 8, background: '#4a9eff', transform: 'rotate(45deg)', display: 'inline-block' }} />
                VARIABLES D&apos;ENVIRONNEMENT
              </div>
              <span style={{
                fontFamily: 'var(--font-space-mono), monospace',
                fontSize: 9.5, color: '#6b6b85', letterSpacing: '0.12em', textTransform: 'uppercase',
              }}>
                {Object.values(data.env).filter(Boolean).length}/{Object.keys(data.env).length} CONFIGURÉES
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              {Object.entries(data.env).map(([key, present]) => (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: '#0d0d14', border: '1px solid #1f1f30',
                  borderRadius: 8, padding: '10px 14px',
                }}>
                  <StatusDot ok={present} />
                  <span style={{
                    fontFamily: 'var(--font-space-mono), monospace',
                    fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: present ? '#9898b0' : '#ff4d2e',
                  }}>
                    {key}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Actions */}
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
          <Link href="/" style={{
            padding: '10px 20px', borderRadius: 8, textDecoration: 'none',
            background: 'transparent', border: '1px solid #1f1f30',
            color: '#6b6b85', fontFamily: 'var(--font-space-mono), monospace',
            fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
            display: 'inline-block',
          }}>
            ← RETOUR ACCUEIL
          </Link>
        </div>

      </main>
    </div>
  );
}
