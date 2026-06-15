'use client';
import { useRouter } from 'next/navigation';
import { CountryFlag } from '@/components/design/CountryFlag';
import { DestinationImage } from '@/components/design/DestinationImage';
import { getDestinationImagery, hasDestinationPhoto } from '@/lib/design/destinationImagery';

/**
 * FRONT-002 — Editorial destination entry points (formerly "Fenêtres optimales").
 * FRONT-023 — Recadrage « points d'entrée d'analyse » : le ton « blog voyage » est
 *   retiré au profit d'un registre analyse/contexte, et les pays sont dé-dupliqués
 *   du rail hero (HERO_RAIL = PT/GE/MA/JP/VN/AL) en choisissant GR/TH/TN — couverts,
 *   absents du rail — pour qu'aucune destination n'apparaisse deux fois sur la home.
 *
 * HONESTY: all fabricated metrics removed — no invented dates, prices, FX deltas,
 * or safety scores. Each card carries only real product data: a covered destination
 * (FRONT-001 imagery + flag), its region, and a CTA that navigates to /results with
 * real pre-filled params (mode / budget / duration / continent). Route behavior
 * unchanged — these are analysis shortcuts, not a scored ranking.
 *
 * `code` keys into the FRONT-001 destination imagery registry (TARGET_COUNTRIES).
 */
const ENTRIES: {
  code: string;
  positioning: string;
  href: string;
}[] = [
  {
    code: 'GR',
    positioning: "Un point d'entrée pour tester une analyse Europe, budget maîtrisé.",
    href: '/results?mode=standard&budget=1800&duration=15&travelType=solo&continent=Europe',
  },
  {
    code: 'TH',
    positioning: 'Un exemple long-courrier pour comparer coût, distance et contexte local.',
    href: '/results?mode=standard&budget=2400&duration=14&travelType=solo&continent=Asia',
  },
  {
    code: 'TN',
    positioning: "Un scénario proche pour observer l'équilibre budget, saison et stabilité.",
    href: '/results?mode=budget_crisis&budget=1200&duration=14&travelType=solo&continent=Africa',
  },
  {
    code: 'CO',
    positioning: 'Un exemple Amériques pour explorer un profil découverte hors des sentiers battus.',
    href: '/results?mode=standard&budget=2000&duration=14&travelType=solo&continent=Americas',
  },
];

export function OpportunityCards() {
  const router = useRouter();

  return (
    <>
      {/* Intro — recadrage « points d'entrée d'analyse » (FRONT-023) */}
      <p
        className="ctv3-serif"
        style={{ maxWidth: 620, color: 'var(--ctv3-muted)', fontSize: 14.5, lineHeight: 1.6, margin: '0 0 18px' }}
      >
        Choisissez un exemple pour lancer une analyse pré-remplie, puis comparez avec les signaux disponibles.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        {ENTRIES.map((e) => {
        const ident = getDestinationImagery(e.code);
        return (
          <article
            key={e.code}
            role="button"
            tabIndex={0}
            onClick={() => router.push(e.href)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter' || ev.key === ' ') router.push(e.href);
            }}
            style={{
              cursor: 'pointer',
              border: '1px solid var(--ctv3-line)',
              background: 'var(--ctv3-ink-850)',
              overflow: 'hidden',
              transition: 'border-color .2s, transform .2s',
            }}
            onMouseEnter={(ev) => {
              ev.currentTarget.style.borderColor = 'var(--ctv3-line-bright)';
              ev.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(ev) => {
              ev.currentTarget.style.borderColor = 'var(--ctv3-line)';
              ev.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {/* Photo-led: curated local photo when available (FRONT-024D), else premium duotone (FRONT-001) */}
            <DestinationImage code={e.code} slot="card" aspect="16/10" showLabel={false} scrim="soft" hasPhoto={hasDestinationPhoto(e.code)} />

            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <CountryFlag code={e.code} width={24} />
                <span
                  style={{
                    fontFamily: 'var(--ctv3-display)',
                    fontWeight: 800,
                    fontSize: 16,
                    letterSpacing: '-0.01em',
                    color: 'var(--ctv3-paper)',
                  }}
                >
                  {ident.name}
                </span>
                <span
                  className="ctv3-mono"
                  style={{
                    marginLeft: 'auto',
                    fontSize: 9,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--ctv3-faint)',
                  }}
                >
                  {ident.region}
                </span>
              </div>

              <p
                className="ctv3-serif"
                style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--ctv3-muted)', margin: 0 }}
              >
                {e.positioning}
              </p>

              <span
                className="ctv3-mono"
                style={{
                  marginTop: 2,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--ctv3-red)',
                  fontWeight: 500,
                }}
              >
                Lancer une analyse pré-remplie
              </span>
            </div>
          </article>
        );
        })}
      </div>
    </>
  );
}
