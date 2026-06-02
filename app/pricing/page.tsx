'use client';
import { useState } from 'react';
import { Header } from '@/components/layout/Header';

const PLANS = [
  {
    id: 'free',
    name: 'GRATUIT',
    price: 0,
    period: 'toujours',
    color: '#6b6b85',
    features: [
      { label: '3 analyses complètes / mois', included: true },
      { label: 'Accès lecture fiches destinations', included: true },
      { label: 'CrisisScore en temps réel', included: true },
      { label: 'Analyses illimitées', included: false },
      { label: 'Alertes push par email', included: false },
      { label: 'Export PDF rapport voyage', included: false },
      { label: 'Historique des scores (6 mois)', included: false },
      { label: 'Accès API B2B', included: false },
    ],
  },
  {
    id: 'premium_monthly',
    name: 'PREMIUM',
    price: 9,
    period: '/mois',
    color: '#ffb224',
    highlight: true,
    badge: 'POPULAIRE',
    features: [
      { label: 'Analyses illimitées', included: true },
      { label: 'Alertes push par email', included: true },
      { label: 'Export PDF rapport voyage', included: true },
      { label: 'Historique des scores (6 mois)', included: true },
      { label: 'Fiches destinations complètes', included: true },
      { label: 'Tri et filtres avancés', included: true },
      { label: 'Support prioritaire', included: true },
      { label: 'Accès API B2B', included: false },
    ],
  },
  {
    id: 'premium_annual',
    name: 'PREMIUM ANNUEL',
    price: 79,
    period: '/an',
    saving: '−29%',
    color: '#3ddc97',
    features: [
      { label: 'Tout Premium mensuel', included: true },
      { label: '29% d\'économie vs mensuel', included: true },
      { label: 'Priorité nouvelles fonctionnalités', included: true },
      { label: 'Accès bêta', included: true },
      { label: 'Support prioritaire', included: true },
      { label: 'Fiches destinations complètes', included: true },
      { label: 'Alertes push par email', included: true },
      { label: 'Accès API B2B', included: false },
    ],
  },
];

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe(planId: string) {
    if (planId === 'free') return;

    setLoading(planId);
    setError(null);

    try {
      const plan = planId === 'premium_annual' ? 'annual' : 'monthly';
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();

      if (res.status === 401) {
        // Non connecté — rediriger vers l'accueil avec modal auth
        window.location.href = '/?auth=required';
        return;
      }

      if (!res.ok) {
        setError(data.error ?? 'Erreur lors de la création de la session de paiement');
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError('Erreur réseau. Réessayez.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#07070c' }}>
      <Header />

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '0 20px 80px' }}>

        {/* Hero */}
        <section style={{ padding: '40px 0 36px', textAlign: 'center', position: 'relative' }}>
          <div style={{
            fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
            fontSize: 9.5, letterSpacing: '0.2em', color: '#ff3b2f',
            textTransform: 'uppercase', marginBottom: 14, display: 'inline-flex',
            alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 6, height: 6, background: '#ff3b2f', transform: 'rotate(45deg)', display: 'inline-block' }} />
            TARIFS
          </div>
          <h1 style={{
            margin: '0 0 14px', fontFamily: 'var(--font-space-mono), monospace',
            fontSize: 'clamp(28px, 7vw, 42px)', fontWeight: 700,
            letterSpacing: '-0.03em', color: '#f0f0f5', lineHeight: 1.1,
          }}>
            VOYAGEZ<br/><span style={{ color: '#ff3b2f' }}>INTELLIGENT</span>
          </h1>
          <p style={{ color: '#9898b0', fontSize: 15, lineHeight: 1.5, maxWidth: 480, margin: '0 auto' }}>
            Commencez gratuitement. Passez à Premium pour des analyses illimitées et des alertes en temps réel.
          </p>
        </section>

        {/* Grille des plans */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}>
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              style={{
                background: plan.highlight
                  ? 'linear-gradient(135deg, rgba(255,178,36,0.08), rgba(17,17,28,0.9))'
                  : 'rgba(17,17,28,0.7)',
                border: `1px solid ${plan.highlight ? 'rgba(255,178,36,0.35)' : '#1f1f30'}`,
                borderRadius: 14, padding: '24px 20px',
                position: 'relative', overflow: 'hidden',
                boxShadow: plan.highlight ? '0 8px 32px rgba(255,178,36,0.12)' : 'none',
              }}
            >
              {/* Badge populaire */}
              {plan.badge && (
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                  background: plan.color, color: '#07070c',
                  fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                  fontSize: '0.52rem', letterSpacing: '0.12em', fontWeight: 700,
                  padding: '3px 8px', borderRadius: 4,
                }}>
                  {plan.badge}
                </div>
              )}

              {/* Économie */}
              {plan.saving && (
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                  background: 'rgba(61,220,151,0.2)', border: '1px solid rgba(61,220,151,0.4)',
                  color: '#3ddc97',
                  fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                  fontSize: '0.52rem', letterSpacing: '0.12em', fontWeight: 700,
                  padding: '3px 8px', borderRadius: 4,
                }}>
                  {plan.saving}
                </div>
              )}

              {/* Nom du plan */}
              <div style={{
                fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                fontSize: '0.62rem', letterSpacing: '0.18em', color: plan.color,
                fontWeight: 700, textTransform: 'uppercase', marginBottom: 14,
              }}>
                {plan.name}
              </div>

              {/* Prix */}
              <div style={{ marginBottom: 20 }}>
                <span style={{
                  fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                  fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em',
                  color: '#f0f0f5', lineHeight: 1,
                }}>
                  {plan.price === 0 ? '0€' : `${plan.price}€`}
                </span>
                <span style={{
                  fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                  fontSize: 11, color: '#6b6b85', marginLeft: 6,
                }}>
                  {plan.period}
                </span>
              </div>

              {/* Features */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {plan.features.map((f, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 12.5, color: f.included ? '#c8c8da' : '#3f3f5a',
                  }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                      display: 'grid', placeItems: 'center',
                      background: f.included ? `${plan.color}20` : '#1e1e2e',
                      color: f.included ? plan.color : '#3f3f5a',
                      fontSize: 9, fontWeight: 700,
                    }}>
                      {f.included ? '✓' : '×'}
                    </span>
                    {f.label}
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={plan.id === 'free' || loading === plan.id}
                style={{
                  width: '100%', padding: '11px', borderRadius: 10, cursor: plan.id === 'free' ? 'default' : 'pointer',
                  background: plan.id === 'free'
                    ? 'transparent'
                    : plan.highlight
                      ? plan.color
                      : `${plan.color}20`,
                  border: `1px solid ${plan.id === 'free' ? '#1f1f30' : plan.color}`,
                  color: plan.id === 'free' ? '#3f3f5a' : plan.highlight ? '#07070c' : plan.color,
                  fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
                  fontSize: '0.68rem', letterSpacing: '0.1em', fontWeight: 700,
                  transition: 'all 0.2s',
                  boxShadow: plan.highlight && plan.id !== 'free' ? `0 4px 16px ${plan.color}40` : 'none',
                }}
                onMouseEnter={(e) => {
                  if (plan.id !== 'free') {
                    e.currentTarget.style.opacity = '0.85';
                  }
                }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
              >
                {loading === plan.id ? '⏳ REDIRECTION...' :
                 plan.id === 'free' ? 'PLAN ACTUEL' :
                 plan.id === 'premium_annual' ? '⚡ CHOISIR ANNUEL →' :
                 '⚡ PASSER PREMIUM →'}
              </button>
            </div>
          ))}
        </div>

        {/* Erreur */}
        {error && (
          <div style={{
            padding: '12px 16px', borderRadius: 8, marginBottom: 24,
            background: 'rgba(255,59,47,0.1)', border: '1px solid rgba(255,59,47,0.3)',
            color: '#ff3b2f', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* FAQ */}
        <div style={{ borderTop: '1px solid #1f1f30', paddingTop: 32 }}>
          <div style={{
            fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
            fontSize: 10, letterSpacing: '0.16em', color: '#6b6b85',
            textTransform: 'uppercase', marginBottom: 20, textAlign: 'center',
          }}>
            QUESTIONS FRÉQUENTES
          </div>

          {[
            {
              q: 'Puis-je annuler à tout moment ?',
              a: 'Oui. Vous pouvez annuler depuis votre espace client Stripe. L\'accès Premium reste actif jusqu\'à la fin de la période payée.',
            },
            {
              q: 'Qu\'est-ce qu\'une "analyse" ?',
              a: 'Une analyse = une recherche complète qui calcule le CrisisScore pour tous les pays selon vos critères. La lecture des fiches destinations ne compte pas.',
            },
            {
              q: 'Les données sont-elles vraiment en temps réel ?',
              a: 'Oui. Les alertes MEAE et données géopolitiques sont mises à jour toutes les 30 minutes. Le World Bank et le coût de vie sont mis à jour quotidiennement.',
            },
            {
              q: 'Puis-je utiliser Crisis Travel pour mon entreprise ?',
              a: 'Les plans individuels couvrent un usage personnel et professionnel limité. Pour un usage équipe (DRH, voyages d\'affaires, ONG), une offre B2B / accès API est en préparation — contactez-nous pour en discuter.',
            },
          ].map((item, i) => (
            <div key={i} style={{
              marginBottom: 16, padding: '14px 16px',
              background: 'rgba(17,17,28,0.5)', border: '1px solid #1f1f30',
              borderRadius: 10,
            }}>
              <div style={{ color: '#f0f0f5', fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>
                {item.q}
              </div>
              <div style={{ color: '#9898b0', fontSize: 12.5, lineHeight: 1.5 }}>
                {item.a}
              </div>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <p style={{
          textAlign: 'center', fontSize: 11, color: '#3f3f5a', lineHeight: 1.5, marginTop: 24,
          fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)', letterSpacing: '0.04em',
        }}>
          Paiement sécurisé par Stripe · Aucune carte requise pour le plan gratuit
        </p>

      </main>
    </div>
  );
}
