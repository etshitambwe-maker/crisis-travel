import { MEAE_LEVELS, MEAE_LAST_UPDATED } from '@/lib/services/security/meae.service';
import { TARGET_COUNTRIES } from '@/lib/utils/countries';

export type MeaeTickerItem = {
  code: string;
  name: string;
  level: 3 | 4;
  label: string;
  officialUrl: string;
};

const MEAE_BASE_URL =
  'https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/conseils-par-pays-destination/';

const LEVEL_LABEL: Record<3 | 4, string> = {
  3: 'Déconseillé sauf raison impérative',
  4: 'Formellement déconseillé',
};

export function getMeaeTickerItems(): MeaeTickerItem[] {
  return Object.entries(MEAE_LEVELS)
    .filter((entry): entry is [string, 3 | 4] => entry[1] === 3 || entry[1] === 4)
    .map(([code, level]) => {
      const country = TARGET_COUNTRIES.find((c) => c.code === code);
      const name = country?.name ?? code;
      const slug = country?.meaeSlug;
      const officialUrl = slug ? `${MEAE_BASE_URL}${slug}/` : MEAE_BASE_URL;
      return { code, name, level, label: LEVEL_LABEL[level], officialUrl };
    })
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, 'fr'));
}

export { MEAE_LAST_UPDATED };
