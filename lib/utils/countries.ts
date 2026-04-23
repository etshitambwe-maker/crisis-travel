export const TARGET_COUNTRIES = [
  { code: 'TH', name: 'Thaïlande', continent: 'Asia', acledName: 'Thailand', iso3: 'THA', meaeSlug: 'thailande' },
  { code: 'GE', name: 'Géorgie', continent: 'Europe', acledName: 'Georgia', iso3: 'GEO', meaeSlug: 'georgie' },
  { code: 'PT', name: 'Portugal', continent: 'Europe', acledName: 'Portugal', iso3: 'PRT', meaeSlug: 'portugal' },
  { code: 'MA', name: 'Maroc', continent: 'Africa', acledName: 'Morocco', iso3: 'MAR', meaeSlug: 'maroc' },
  { code: 'VN', name: 'Vietnam', continent: 'Asia', acledName: 'Vietnam', iso3: 'VNM', meaeSlug: 'vietnam' },
  { code: 'MX', name: 'Mexique', continent: 'Americas', acledName: 'Mexico', iso3: 'MEX', meaeSlug: 'mexique' },
  { code: 'AL', name: 'Albanie', continent: 'Europe', acledName: 'Albania', iso3: 'ALB', meaeSlug: 'albanie' },
  { code: 'RS', name: 'Serbie', continent: 'Europe', acledName: 'Serbia', iso3: 'SRB', meaeSlug: 'serbie' },
  { code: 'BA', name: 'Bosnie', continent: 'Europe', acledName: 'Bosnia-Herzegovina', iso3: 'BIH', meaeSlug: 'bosnie-herzegovine' },
  { code: 'KG', name: 'Kirghizistan', continent: 'Asia', acledName: 'Kyrgyzstan', iso3: 'KGZ', meaeSlug: 'kirghizistan' },
  { code: 'MD', name: 'Moldavie', continent: 'Europe', acledName: 'Moldova', iso3: 'MDA', meaeSlug: 'moldavie' },
  { code: 'JP', name: 'Japon', continent: 'Asia', acledName: 'Japan', iso3: 'JPN', meaeSlug: 'japon' },
  { code: 'ID', name: 'Indonésie', continent: 'Asia', acledName: 'Indonesia', iso3: 'IDN', meaeSlug: 'indonesie' },
  { code: 'CO', name: 'Colombie', continent: 'Americas', acledName: 'Colombia', iso3: 'COL', meaeSlug: 'colombie' },
  { code: 'PE', name: 'Pérou', continent: 'Americas', acledName: 'Peru', iso3: 'PER', meaeSlug: 'perou' },
  { code: 'TR', name: 'Turquie', continent: 'Europe', acledName: 'Turkey', iso3: 'TUR', meaeSlug: 'turquie' },
  { code: 'EG', name: 'Égypte', continent: 'Africa', acledName: 'Egypt', iso3: 'EGY', meaeSlug: 'egypte' },
  { code: 'TN', name: 'Tunisie', continent: 'Africa', acledName: 'Tunisia', iso3: 'TUN', meaeSlug: 'tunisie' },
  { code: 'MK', name: 'Macédoine du Nord', continent: 'Europe', acledName: 'Macedonia', iso3: 'MKD', meaeSlug: 'macedoine-du-nord' },
  { code: 'AM', name: 'Arménie', continent: 'Europe', acledName: 'Armenia', iso3: 'ARM', meaeSlug: 'armenie' },
  { code: 'UZ', name: 'Ouzbékistan', continent: 'Asia', acledName: 'Uzbekistan', iso3: 'UZB', meaeSlug: 'ouzbekistan' },
  { code: 'KH', name: 'Cambodge', continent: 'Asia', acledName: 'Cambodia', iso3: 'KHM', meaeSlug: 'cambodge' },
  { code: 'LK', name: 'Sri Lanka', continent: 'Asia', acledName: 'Sri Lanka', iso3: 'LKA', meaeSlug: 'sri-lanka' },
  { code: 'PH', name: 'Philippines', continent: 'Asia', acledName: 'Philippines', iso3: 'PHL', meaeSlug: 'philippines' },
  { code: 'EC', name: 'Équateur', continent: 'Americas', acledName: 'Ecuador', iso3: 'ECU', meaeSlug: 'equateur' },
] as const;

export type CountryCode = typeof TARGET_COUNTRIES[number]['code'];

export function findCountry(code: string) {
  return TARGET_COUNTRIES.find((c) => c.code === code.toUpperCase()) ?? null;
}
