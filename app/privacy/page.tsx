import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Politique de confidentialité — Crisis Travel',
  description: 'Comment Crisis Travel collecte, utilise et protège vos données personnelles.',
};

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#07070c' }}>
      <Header />

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 80px' }}>

        {/* Badge */}
        <div style={{
          fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
          fontSize: 9.5, letterSpacing: '0.2em', color: '#ff3b2f',
          textTransform: 'uppercase', marginBottom: 14,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ width: 6, height: 6, background: '#ff3b2f', transform: 'rotate(45deg)', display: 'inline-block' }} />
          LÉGAL
        </div>

        <h1 style={{
          margin: '0 0 8px',
          fontFamily: 'var(--font-space-mono), monospace',
          fontSize: 'clamp(24px, 5vw, 34px)', fontWeight: 700,
          letterSpacing: '-0.03em', color: '#f0f0f5', lineHeight: 1.15,
        }}>
          Politique de confidentialité
        </h1>

        <p style={{ color: '#3f3f5a', fontSize: 12, marginBottom: 40, fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)', letterSpacing: '0.04em' }}>
          Dernière mise à jour : 1 juin 2026
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

          <Section title="1. Qui sommes-nous">
            <p>Crisis Travel est une application d&apos;aide à la décision de voyage fournissant des informations géopolitiques, sécuritaires et économiques sur les destinations mondiales. L&apos;application est exploitée à titre individuel. Pour toute question relative à vos données, contactez-nous à : <a href="mailto:etshitambwe@gmail.com" style={{ color: '#ff3b2f', textDecoration: 'none' }}>etshitambwe@gmail.com</a></p>
          </Section>

          <Section title="2. Données collectées">
            <p>Selon la façon dont vous utilisez Crisis Travel, nous pouvons collecter les données suivantes :</p>
            <ul>
              <li><strong style={{ color: '#c8c8da' }}>Adresse email</strong> — lors de la connexion via lien magique ou création de compte.</li>
              <li><strong style={{ color: '#c8c8da' }}>Nom et photo de profil Google</strong> — uniquement si vous choisissez la connexion via Google OAuth. Ces données sont transmises par Google avec votre consentement explicite.</li>
              <li><strong style={{ color: '#c8c8da' }}>Données de navigation</strong> — les pages visitées et actions effectuées dans l&apos;application, à des fins d&apos;amélioration du service.</li>
              <li><strong style={{ color: '#c8c8da' }}>Données de paiement</strong> — si vous souscrivez à un abonnement Premium, votre paiement est traité exclusivement par Stripe. Crisis Travel ne stocke jamais vos informations bancaires.</li>
            </ul>
            <p>Nous ne collectons pas de données de localisation en temps réel, ni de données sensibles au sens du RGPD.</p>
          </Section>

          <Section title="3. Utilisation des données">
            <p>Vos données sont utilisées uniquement pour :</p>
            <ul>
              <li>Gérer votre compte et authentification</li>
              <li>Fournir les fonctionnalités de l&apos;application (analyses, alertes, historique)</li>
              <li>Gérer votre abonnement et la facturation via Stripe</li>
              <li>Vous envoyer des alertes pays si vous avez activé cette option</li>
              <li>Améliorer le service sur la base des usages agrégés</li>
            </ul>
            <p>Nous ne vendons pas vos données à des tiers et nous ne les utilisons pas à des fins publicitaires.</p>
          </Section>

          <Section title="4. Services tiers">
            <p>Crisis Travel fait appel aux services tiers suivants, chacun disposant de sa propre politique de confidentialité :</p>
            <ul>
              <li><strong style={{ color: '#c8c8da' }}>Supabase</strong> — base de données et authentification. Vos données de compte sont hébergées sur leur infrastructure.</li>
              <li><strong style={{ color: '#c8c8da' }}>Stripe</strong> — traitement des paiements. Stripe est conforme PCI-DSS. Crisis Travel ne voit jamais vos coordonnées bancaires complètes.</li>
              <li><strong style={{ color: '#c8c8da' }}>Vercel</strong> — hébergement de l&apos;application et des API. Les requêtes transitent par leur infrastructure Edge.</li>
              <li><strong style={{ color: '#c8c8da' }}>Google</strong> — authentification OAuth optionnelle. Utilisée uniquement si vous cliquez sur &quot;Continuer avec Google&quot;.</li>
              <li><strong style={{ color: '#c8c8da' }}>Partenaires affiliés</strong> — certains liens de réservation présents dans l&apos;application (hôtels, vols) peuvent être des liens d&apos;affiliation. Cela ne change pas le prix que vous payez.</li>
            </ul>
          </Section>

          <Section title="5. Cookies et stockage local">
            <p>Crisis Travel utilise des cookies de session pour maintenir votre connexion (gérés par Supabase Auth). Ces cookies sont strictement nécessaires au fonctionnement de l&apos;application. Aucun cookie publicitaire ou de tracking tiers n&apos;est utilisé.</p>
          </Section>

          <Section title="6. Conservation des données">
            <p>Vos données de compte sont conservées tant que votre compte est actif. Si vous souhaitez supprimer votre compte et toutes les données associées, contactez-nous à <a href="mailto:etshitambwe@gmail.com" style={{ color: '#ff3b2f', textDecoration: 'none' }}>etshitambwe@gmail.com</a>. La suppression est effective sous 30 jours.</p>
          </Section>

          <Section title="7. Vos droits (RGPD)">
            <p>Si vous êtes résident de l&apos;Union Européenne, vous disposez des droits suivants :</p>
            <ul>
              <li>Droit d&apos;accès à vos données personnelles</li>
              <li>Droit de rectification</li>
              <li>Droit à l&apos;effacement (&quot;droit à l&apos;oubli&quot;)</li>
              <li>Droit à la portabilité</li>
              <li>Droit d&apos;opposition au traitement</li>
            </ul>
            <p>Pour exercer ces droits, contactez-nous à <a href="mailto:etshitambwe@gmail.com" style={{ color: '#ff3b2f', textDecoration: 'none' }}>etshitambwe@gmail.com</a>.</p>
          </Section>

          <Section title="8. Sécurité">
            <p>Crisis Travel met en œuvre des mesures techniques raisonnables pour protéger vos données : connexions HTTPS, Row Level Security Supabase, et clés API jamais exposées côté client. Aucun système n&apos;est infaillible ; en cas d&apos;incident de sécurité affectant vos données, nous vous en informerons dans les délais légaux.</p>
          </Section>

          <Section title="9. Modifications">
            <p>Cette politique peut être mise à jour. En cas de changement significatif, un avis sera affiché dans l&apos;application. La date de dernière mise à jour est toujours indiquée en haut de cette page.</p>
          </Section>

        </div>

        {/* Back home */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid #1f1f30' }}>
          <Link href="/" style={{
            color: '#6b6b85', fontSize: 12, textDecoration: 'none',
            fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
            letterSpacing: '0.08em',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            ← RETOUR À L&apos;ACCUEIL
          </Link>
        </div>

      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: '20px 22px',
      background: 'rgba(17,17,28,0.5)', border: '1px solid #1f1f30',
      borderRadius: 12,
    }}>
      <h2 style={{
        margin: '0 0 12px',
        fontFamily: 'var(--ct-mono, var(--font-space-mono), monospace)',
        fontSize: '0.72rem', letterSpacing: '0.1em', fontWeight: 700,
        color: '#ff3b2f', textTransform: 'uppercase',
      }}>
        {title}
      </h2>
      <div style={{ color: '#9898b0', fontSize: 13.5, lineHeight: 1.65 }}>
        {children}
      </div>
    </div>
  );
}
