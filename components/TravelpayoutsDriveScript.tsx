'use client';

import Script from 'next/script';

/**
 * Loader du script Travelpayouts Drive (vérification de site + tracking partenaire).
 *
 * Piloté par l'env var publique NEXT_PUBLIC_TRAVELPAYOUTS_DRIVE_SRC :
 *  - var absente/vide  → ne rend rien (SSR/build/dev intacts, aucune injection).
 *  - var présente      → charge le script async via next/script.
 *
 * L'URL réelle n'est JAMAIS écrite dans le code : elle vit uniquement en env
 * (Vercel en production, .env.local en dev). Le placeholder figure dans .env.example.
 *
 * `next/script` avec un `id` stable assure le chargement asynchrone ET la
 * déduplication : le script n'est injecté qu'une seule fois même si le composant
 * est monté plusieurs fois.
 */
export function TravelpayoutsDriveScript() {
  const src = process.env.NEXT_PUBLIC_TRAVELPAYOUTS_DRIVE_SRC;

  if (!src) return null;

  return (
    <Script
      id="travelpayouts-drive"
      src={src}
      strategy="afterInteractive"
    />
  );
}
