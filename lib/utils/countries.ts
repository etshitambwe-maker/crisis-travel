export const TARGET_COUNTRIES = [
  // ─── EUROPE ───────────────────────────────────────────────────────
  { code: 'PT', name: 'Portugal',            continent: 'Europe',   acledName: 'Portugal',            iso3: 'PRT', meaeSlug: 'portugal',            aliases: ['port'] },
  { code: 'GE', name: 'Géorgie',             continent: 'Europe',   acledName: 'Georgia',             iso3: 'GEO', meaeSlug: 'georgie',             aliases: ['georgia'] },
  { code: 'AL', name: 'Albanie',             continent: 'Europe',   acledName: 'Albania',             iso3: 'ALB', meaeSlug: 'albanie',             aliases: ['albania'] },
  { code: 'RS', name: 'Serbie',              continent: 'Europe',   acledName: 'Serbia',              iso3: 'SRB', meaeSlug: 'serbie',              aliases: ['serbia'] },
  { code: 'BA', name: 'Bosnie',              continent: 'Europe',   acledName: 'Bosnia-Herzegovina',  iso3: 'BIH', meaeSlug: 'bosnie-herzegovine', aliases: ['bosnie-herzegovine', 'bih'] },
  { code: 'MD', name: 'Moldavie',            continent: 'Europe',   acledName: 'Moldova',             iso3: 'MDA', meaeSlug: 'moldavie',            aliases: ['moldova'] },
  { code: 'MK', name: 'Macédoine du Nord',   continent: 'Europe',   acledName: 'Macedonia',           iso3: 'MKD', meaeSlug: 'macedoine-du-nord',  aliases: ['macedoine', 'north macedonia'] },
  { code: 'AM', name: 'Arménie',             continent: 'Europe',   acledName: 'Armenia',             iso3: 'ARM', meaeSlug: 'armenie',             aliases: ['armenia'] },
  { code: 'TR', name: 'Turquie',             continent: 'Europe',   acledName: 'Turkey',              iso3: 'TUR', meaeSlug: 'turquie',             aliases: ['turkey'] },
  { code: 'ME', name: 'Monténégro',          continent: 'Europe',   acledName: 'Montenegro',          iso3: 'MNE', meaeSlug: 'montenegro',          aliases: ['montenegro'] },
  { code: 'XK', name: 'Kosovo',              continent: 'Europe',   acledName: 'Kosovo',              iso3: 'XKX', meaeSlug: 'kosovo',              aliases: [] },
  { code: 'GR', name: 'Grèce',              continent: 'Europe',   acledName: 'Greece',              iso3: 'GRC', meaeSlug: 'grece',               aliases: ['greece'] },
  { code: 'HR', name: 'Croatie',             continent: 'Europe',   acledName: 'Croatia',             iso3: 'HRV', meaeSlug: 'croatie',             aliases: ['croatia'] },
  { code: 'HU', name: 'Hongrie',             continent: 'Europe',   acledName: 'Hungary',             iso3: 'HUN', meaeSlug: 'hongrie',             aliases: ['hungary'] },

  // ─── AFRIQUE ──────────────────────────────────────────────────────
  { code: 'MA', name: 'Maroc',               continent: 'Africa',   acledName: 'Morocco',             iso3: 'MAR', meaeSlug: 'maroc',               aliases: ['morocco'] },
  { code: 'TN', name: 'Tunisie',             continent: 'Africa',   acledName: 'Tunisia',             iso3: 'TUN', meaeSlug: 'tunisie',             aliases: ['tunisia'] },
  { code: 'EG', name: 'Égypte',             continent: 'Africa',   acledName: 'Egypt',               iso3: 'EGY', meaeSlug: 'egypte',              aliases: ['egypt'] },
  { code: 'SN', name: 'Sénégal',            continent: 'Africa',   acledName: 'Senegal',             iso3: 'SEN', meaeSlug: 'senegal',             aliases: ['senegal', 'dakar'] },
  { code: 'CI', name: "Côte d'Ivoire",      continent: 'Africa',   acledName: "Cote d'Ivoire",       iso3: 'CIV', meaeSlug: 'cote-d-ivoire',       aliases: ['ivory coast', 'abidjan', 'ivoirien'] },
  { code: 'GH', name: 'Ghana',               continent: 'Africa',   acledName: 'Ghana',               iso3: 'GHA', meaeSlug: 'ghana',               aliases: ['accra'] },
  { code: 'KE', name: 'Kenya',               continent: 'Africa',   acledName: 'Kenya',               iso3: 'KEN', meaeSlug: 'kenya',               aliases: ['nairobi'] },
  { code: 'TZ', name: 'Tanzanie',            continent: 'Africa',   acledName: 'Tanzania',            iso3: 'TZA', meaeSlug: 'tanzanie',            aliases: ['tanzania', 'zanzibar', 'dar es salaam'] },
  { code: 'RW', name: 'Rwanda',              continent: 'Africa',   acledName: 'Rwanda',              iso3: 'RWA', meaeSlug: 'rwanda',              aliases: ['kigali'] },
  { code: 'ET', name: 'Éthiopie',           continent: 'Africa',   acledName: 'Ethiopia',            iso3: 'ETH', meaeSlug: 'ethiopie',            aliases: ['ethiopia', 'addis'] },
  { code: 'ZA', name: 'Afrique du Sud',      continent: 'Africa',   acledName: 'South Africa',        iso3: 'ZAF', meaeSlug: 'afrique-du-sud',      aliases: ['south africa', 'cape town', 'johannesburg'] },
  { code: 'MU', name: 'Maurice',             continent: 'Africa',   acledName: 'Mauritius',           iso3: 'MUS', meaeSlug: 'maurice',             aliases: ['mauritius', 'île maurice'] },
  { code: 'MG', name: 'Madagascar',          continent: 'Africa',   acledName: 'Madagascar',          iso3: 'MDG', meaeSlug: 'madagascar',          aliases: ['mada'] },
  { code: 'CM', name: 'Cameroun',            continent: 'Africa',   acledName: 'Cameroon',            iso3: 'CMR', meaeSlug: 'cameroun',            aliases: ['cameroon', 'yaounde', 'douala'] },
  { code: 'CG', name: 'Congo',               continent: 'Africa',   acledName: 'Republic of Congo',   iso3: 'COG', meaeSlug: 'congo-brazzaville',   aliases: ['congo brazzaville', 'brazzaville', 'congo-b'] },
  { code: 'CD', name: 'RD Congo',            continent: 'Africa',   acledName: 'Democratic Republic of Congo', iso3: 'COD', meaeSlug: 'republique-democratique-du-congo', aliases: ['rdc', 'drc', 'kinshasa', 'congo kinshasa', 'zaire'] },
  { code: 'NG', name: 'Nigeria',             continent: 'Africa',   acledName: 'Nigeria',             iso3: 'NGA', meaeSlug: 'nigeria',             aliases: ['lagos', 'abuja'] },
  { code: 'AO', name: 'Angola',              continent: 'Africa',   acledName: 'Angola',              iso3: 'AGO', meaeSlug: 'angola',              aliases: ['luanda'] },

  // ─── ASIE ─────────────────────────────────────────────────────────
  { code: 'TH', name: 'Thaïlande',          continent: 'Asia',     acledName: 'Thailand',            iso3: 'THA', meaeSlug: 'thailande',           aliases: ['thailand', 'bangkok', 'thai'] },
  { code: 'VN', name: 'Vietnam',             continent: 'Asia',     acledName: 'Vietnam',             iso3: 'VNM', meaeSlug: 'vietnam',             aliases: ['hanoi', 'ho chi minh'] },
  { code: 'JP', name: 'Japon',               continent: 'Asia',     acledName: 'Japan',               iso3: 'JPN', meaeSlug: 'japon',               aliases: ['japan', 'tokyo'] },
  { code: 'ID', name: 'Indonésie',          continent: 'Asia',     acledName: 'Indonesia',           iso3: 'IDN', meaeSlug: 'indonesie',           aliases: ['indonesia', 'bali', 'jakarta'] },
  { code: 'KG', name: 'Kirghizistan',        continent: 'Asia',     acledName: 'Kyrgyzstan',          iso3: 'KGZ', meaeSlug: 'kirghizistan',        aliases: ['kyrgyzstan', 'bichkek'] },
  { code: 'UZ', name: 'Ouzbékistan',        continent: 'Asia',     acledName: 'Uzbekistan',          iso3: 'UZB', meaeSlug: 'ouzbekistan',         aliases: ['uzbekistan', 'tachkent', 'samarkande'] },
  { code: 'KH', name: 'Cambodge',            continent: 'Asia',     acledName: 'Cambodia',            iso3: 'KHM', meaeSlug: 'cambodge',            aliases: ['cambodia', 'phnom penh', 'angkor'] },
  { code: 'LK', name: 'Sri Lanka',           continent: 'Asia',     acledName: 'Sri Lanka',           iso3: 'LKA', meaeSlug: 'sri-lanka',           aliases: ['colombo'] },
  { code: 'PH', name: 'Philippines',         continent: 'Asia',     acledName: 'Philippines',         iso3: 'PHL', meaeSlug: 'philippines',         aliases: ['manila', 'cebu'] },
  { code: 'MY', name: 'Malaisie',            continent: 'Asia',     acledName: 'Malaysia',            iso3: 'MYS', meaeSlug: 'malaisie',            aliases: ['malaysia', 'kuala lumpur', 'kl'] },
  { code: 'SG', name: 'Singapour',           continent: 'Asia',     acledName: 'Singapore',           iso3: 'SGP', meaeSlug: 'singapour',           aliases: ['singapore'] },
  { code: 'MM', name: 'Myanmar',             continent: 'Asia',     acledName: 'Myanmar',             iso3: 'MMR', meaeSlug: 'myanmar',             aliases: ['birmanie', 'rangoon', 'yangon'] },
  { code: 'NP', name: 'Népal',              continent: 'Asia',     acledName: 'Nepal',               iso3: 'NPL', meaeSlug: 'nepal',               aliases: ['katmandou', 'kathmandu'] },
  { code: 'IN', name: 'Inde',               continent: 'Asia',     acledName: 'India',               iso3: 'IND', meaeSlug: 'inde',                aliases: ['india', 'delhi', 'mumbai', 'goa'] },
  { code: 'KZ', name: 'Kazakhstan',          continent: 'Asia',     acledName: 'Kazakhstan',          iso3: 'KAZ', meaeSlug: 'kazakhstan',          aliases: ['almaty', 'nursultan', 'astana'] },

  // ─── AMÉRIQUES ────────────────────────────────────────────────────
  { code: 'MX', name: 'Mexique',             continent: 'Americas', acledName: 'Mexico',              iso3: 'MEX', meaeSlug: 'mexique',             aliases: ['mexico', 'cancun', 'cdmx'] },
  { code: 'CO', name: 'Colombie',            continent: 'Americas', acledName: 'Colombia',            iso3: 'COL', meaeSlug: 'colombie',            aliases: ['colombia', 'bogota', 'medellin'] },
  { code: 'PE', name: 'Pérou',              continent: 'Americas', acledName: 'Peru',                iso3: 'PER', meaeSlug: 'perou',               aliases: ['peru', 'lima', 'cusco', 'machu picchu'] },
  { code: 'EC', name: 'Équateur',           continent: 'Americas', acledName: 'Ecuador',             iso3: 'ECU', meaeSlug: 'equateur',            aliases: ['ecuador', 'quito', 'galapagos'] },
  { code: 'BO', name: 'Bolivie',             continent: 'Americas', acledName: 'Bolivia',             iso3: 'BOL', meaeSlug: 'bolivie',             aliases: ['bolivia', 'la paz', 'uyuni'] },
  { code: 'PY', name: 'Paraguay',            continent: 'Americas', acledName: 'Paraguay',            iso3: 'PRY', meaeSlug: 'paraguay',            aliases: ['asuncion'] },
  { code: 'UY', name: 'Uruguay',             continent: 'Americas', acledName: 'Uruguay',             iso3: 'URY', meaeSlug: 'uruguay',             aliases: ['montevideo'] },
  { code: 'GT', name: 'Guatemala',           continent: 'Americas', acledName: 'Guatemala',           iso3: 'GTM', meaeSlug: 'guatemala',           aliases: [] },
  { code: 'CR', name: 'Costa Rica',          continent: 'Americas', acledName: 'Costa Rica',          iso3: 'CRI', meaeSlug: 'costa-rica',          aliases: ['san jose'] },
  { code: 'PA', name: 'Panama',              continent: 'Americas', acledName: 'Panama',              iso3: 'PAN', meaeSlug: 'panama',              aliases: [] },
  { code: 'CU', name: 'Cuba',               continent: 'Americas', acledName: 'Cuba',                iso3: 'CUB', meaeSlug: 'cuba',                aliases: ['havane', 'havana', 'la havane'] },
  { code: 'DO', name: 'République Dominicaine', continent: 'Americas', acledName: 'Dominican Republic', iso3: 'DOM', meaeSlug: 'republique-dominicaine', aliases: ['dominicaine', 'punta cana', 'santo domingo'] },
  { code: 'BR', name: 'Brésil',             continent: 'Americas', acledName: 'Brazil',              iso3: 'BRA', meaeSlug: 'bresil',               aliases: ['brazil', 'rio', 'sao paulo'] },
  { code: 'AR', name: 'Argentine',           continent: 'Americas', acledName: 'Argentina',           iso3: 'ARG', meaeSlug: 'argentine',           aliases: ['argentina', 'buenos aires'] },
  { code: 'CL', name: 'Chili',              continent: 'Americas', acledName: 'Chile',               iso3: 'CHL', meaeSlug: 'chili',               aliases: ['chile', 'santiago'] },

  // ─── MOYEN-ORIENT & ASIE CENTRALE ─────────────────────────────────
  { code: 'JO', name: 'Jordanie',            continent: 'MiddleEast', acledName: 'Jordan',            iso3: 'JOR', meaeSlug: 'jordanie',            aliases: ['jordan', 'amman', 'petra'] },
  { code: 'AE', name: 'Émirats Arabes Unis', continent: 'MiddleEast', acledName: 'United Arab Emirates', iso3: 'ARE', meaeSlug: 'emirats-arabes-unis', aliases: ['uae', 'dubai', 'abu dhabi'] },
  { code: 'OM', name: 'Oman',               continent: 'MiddleEast', acledName: 'Oman',              iso3: 'OMN', meaeSlug: 'oman',               aliases: ['mascate', 'muscat'] },
] as const;

export type CountryCode = typeof TARGET_COUNTRIES[number]['code'];

export function findCountry(code: string) {
  return TARGET_COUNTRIES.find((c) => c.code === code.toUpperCase()) ?? null;
}

/**
 * Recherche floue par nom ou alias.
 * Utilisée par la barre de recherche — retourne jusqu'à 6 suggestions.
 */
export function searchCountries(query: string): typeof TARGET_COUNTRIES[number][] {
  if (!query || query.trim().length < 1) return [];
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  return TARGET_COUNTRIES.filter((c) => {
    const name = c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const matchesName = name.includes(q) || c.code.toLowerCase() === q;
    const matchesAlias = c.aliases.some((a) =>
      a.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)
    );
    return matchesName || matchesAlias;
  }).slice(0, 6);
}
