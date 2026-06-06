import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import Link from 'next/link';

export const metadata: Metadata = {
  title: "Conditions d'utilisation — Crisis Travel",
  description: "Les règles d'utilisation de Crisis Travel : ce que le service propose, ses limites et vos responsabilités.",
};

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#07070c' }}>
      <Header />

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 80px' }}>

        {/* Badge */}
        <div style={{
          fontFamily: 'var(--ctv3-mono)',
          fontSize: 9.5, letterSpacing: '0.2em', color: '#ff3b2f',
          textTransform: 'uppercase', marginBottom: 14,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ width: 6, height: 6, background: '#ff3b2f', transform: 'rotate(45deg)', display: 'inline-block' }} />
          LÉGAL
        </div>

        <h1 style={{
          margin: '0 0 8px',
          fontFamily: 'var(--ctv3-display)',
          fontSize: 'clamp(24px, 5vw, 34px)', fontWeight: 800,
          letterSpacing: '-0.03em', color: '#f0f0f5', lineHeight: 1.15,
        }}>
          {"Conditions d'utilisation"}
        </h1>

        <p style={{ color: '#3f3f5a', fontSize: 12, marginBottom: 40, fontFamily: 'var(--ctv3-mono)', letterSpacing: '0.04em' }}>
          Dernière mise à jour : 1 juin 2026
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

          <Section title="1. Acceptation des conditions">
            <p>En accédant à Crisis Travel et en utilisant ses services, vous acceptez les présentes conditions d&apos;utilisation. Si vous n&apos;acceptez pas ces conditions, veuillez ne pas utiliser l&apos;application.</p>
            <p>Ces conditions peuvent être mises à jour. L&apos;utilisation continue du service après une modification vaut acceptation des nouvelles conditions.</p>
          </Section>

          <Section title="2. Description du service">
            <p>Crisis Travel est un outil d&apos;aide à la décision de voyage. Il fournit des informations agrégées sur les destinations mondiales : indicateurs géopolitiques, niveaux de sécurité, coût de la vie, conditions pratiques et alertes des autorités officielles.</p>
            <p>Le service est disponible en version gratuite (accès limité) et en version Premium (accès complet, sur abonnement).</p>
          </Section>

          <Section title="3. Limites du service et responsabilité">
            <p style={{ padding: '10px 14px', background: 'rgba(255,59,47,0.07)', border: '1px solid rgba(255,59,47,0.2)', borderRadius: 8, marginBottom: 12 }}>
              <strong style={{ color: '#ff3b2f' }}>Important :</strong> Crisis Travel fournit des informations d&apos;aide à la décision, pas des conseils de voyage garantis.
            </p>
            <ul>
              <li>Les données affichées proviennent de sources tierces (gouvernements, organisations internationales, APIs publiques) et peuvent contenir des erreurs ou être incomplètes.</li>
              <li>Crisis Travel ne garantit pas l&apos;exactitude, l&apos;exhaustivité ou l&apos;actualité absolue des informations présentées.</li>
              <li>Les scores et analyses sont des indicateurs synthétiques ; ils ne remplacent pas le jugement personnel ni les conseils d&apos;un professionnel.</li>
              <li><strong style={{ color: '#c8c8da' }}>Vous restez seul responsable de vos décisions de voyage.</strong> Crisis Travel décline toute responsabilité pour les conséquences directes ou indirectes d&apos;une décision prise sur la base de ses informations.</li>
            </ul>
            <p>En cas de voyage dans une zone à risque, consultez toujours les sources officielles de votre gouvernement (ex : France Diplomatie pour les ressortissants français).</p>
          </Section>

          <Section title="4. Compte utilisateur">
            <p>La création d&apos;un compte est optionnelle pour accéder aux fonctionnalités de base. Certaines fonctionnalités avancées (analyses illimitées, alertes, export PDF) nécessitent un compte.</p>
            <ul>
              <li>Vous êtes responsable de la confidentialité de votre compte et de toute activité effectuée depuis celui-ci.</li>
              <li>Vous vous engagez à fournir des informations exactes lors de l&apos;inscription.</li>
              <li>Nous nous réservons le droit de suspendre un compte en cas d&apos;utilisation abusive ou contraire aux présentes conditions.</li>
            </ul>
          </Section>

          <Section title="5. Abonnements et paiements">
            <ul>
              <li>Les abonnements Premium sont facturés via <strong style={{ color: '#c8c8da' }}>Stripe</strong>, plateforme de paiement sécurisée conforme PCI-DSS.</li>
              <li>Le prix affiché est TTC (toutes taxes comprises). Crisis Travel se réserve le droit de modifier ses tarifs avec un préavis raisonnable.</li>
              <li>Vous pouvez annuler votre abonnement à tout moment depuis votre espace client. L&apos;accès Premium reste actif jusqu&apos;à la fin de la période déjà payée — aucun remboursement proratisé n&apos;est prévu sauf obligation légale.</li>
              <li>En cas d&apos;échec de paiement, l&apos;accès Premium peut être suspendu jusqu&apos;à régularisation.</li>
            </ul>
          </Section>

          <Section title="6. Liens affiliés">
            <p>Certains liens de réservation présents dans Crisis Travel (vols, hébergements, assurances) peuvent être des <strong style={{ color: '#c8c8da' }}>liens d&apos;affiliation</strong>. Si vous effectuez un achat via ces liens, Crisis Travel peut percevoir une commission de la part du partenaire concerné.</p>
            <p>Cela ne modifie en aucun cas le prix que vous payez. Les liens affiliés sont utilisés pour contribuer au financement du service. Nous ne recommandons que des partenaires que nous jugeons pertinents pour les utilisateurs.</p>
          </Section>

          <Section title="7. Propriété intellectuelle">
            <p>Le contenu de Crisis Travel (interface, algorithmes, textes, visuels, marque) est la propriété exclusive de ses créateurs. Toute reproduction, distribution ou exploitation commerciale sans autorisation expresse est interdite.</p>
            <p>Les données affichées provenant de sources tierces restent la propriété de leurs auteurs respectifs.</p>
          </Section>

          <Section title="8. Utilisation acceptable">
            <p>Vous vous engagez à ne pas :</p>
            <ul>
              <li>Utiliser des robots, scrapers ou systèmes automatisés pour extraire les données de Crisis Travel sans autorisation</li>
              <li>Tenter de contourner les limites du plan gratuit par des moyens techniques</li>
              <li>Utiliser le service à des fins illégales ou nuisibles</li>
              <li>Revendre ou sous-licencier l&apos;accès au service</li>
            </ul>
          </Section>

          <Section title="9. Disponibilité du service">
            <p>Crisis Travel est fourni &quot;tel quel&quot;, sans garantie de disponibilité continue. Des interruptions de service peuvent survenir pour maintenance, mises à jour ou raisons techniques indépendantes de notre volonté. Aucun remboursement ne sera accordé pour une interruption temporaire.</p>
          </Section>

          <Section title="10. Droit applicable">
            <p>Les présentes conditions sont régies par le droit français. En cas de litige, les parties s&apos;efforceront de trouver une solution amiable avant tout recours judiciaire. À défaut, les tribunaux compétents de Paris seront seuls compétents.</p>
            <p>Pour toute question, contactez-nous à : <a href="mailto:etshitambwe@gmail.com" style={{ color: '#ff3b2f', textDecoration: 'none' }}>etshitambwe@gmail.com</a></p>
          </Section>

        </div>

        {/* Back home */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid #1f1f30' }}>
          <Link href="/" style={{
            color: '#6b6b85', fontSize: 12, textDecoration: 'none',
            fontFamily: 'var(--ctv3-mono)',
            letterSpacing: '0.08em',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            RETOUR À L&apos;ACCUEIL
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
        fontFamily: 'var(--ctv3-mono)',
        fontSize: '0.72rem', letterSpacing: '0.1em', fontWeight: 700,
        color: '#ff3b2f', textTransform: 'uppercase',
      }}>
        {title}
      </h2>
      <div style={{ color: '#9898b0', fontSize: 13.5, lineHeight: 1.65, fontFamily: 'var(--ctv3-serif)' }}>
        {children}
      </div>
    </div>
  );
}
