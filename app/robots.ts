import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crisis-travel.app';

// Indexation publique autorisée. Les routes API et le callback d'auth sont
// exclus du crawl (aucune page indexable, évite que les bots les sollicitent).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/auth/', '/design-preview'],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
