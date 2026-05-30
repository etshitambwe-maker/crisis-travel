import type { MetadataRoute } from 'next';
import { TARGET_COUNTRIES } from '@/lib/utils/countries';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crisis-travel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/results`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ];

  const destinationRoutes: MetadataRoute.Sitemap = TARGET_COUNTRIES.map((c) => ({
    url: `${BASE_URL}/destination/${c.code.toLowerCase()}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  return [...staticRoutes, ...destinationRoutes];
}
