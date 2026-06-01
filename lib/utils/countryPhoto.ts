// Couleurs dominantes par pays (fond de card)
const COUNTRY_COLORS: Record<string, [string, string]> = {
  PT: ['#006600', '#FF0000'], GE: ['#FF0000', '#FFFFFF'], AL: ['#E41E20', '#000000'],
  RS: ['#C6363C', '#0C4076'], BA: ['#002395', '#FCCA02'], MD: ['#003DA5', '#CC0001'],
  MK: ['#CE2028', '#F7D618'], AM: ['#D90012', '#003580'], TR: ['#E30A17', '#FFFFFF'],
  ME: ['#D4AF37', '#D4AF37'], XK: ['#244AA5', '#E4C044'], GR: ['#0D5EAF', '#FFFFFF'],
  HR: ['#FF0000', '#003DA5'], HU: ['#CE2939', '#436F4D'],
  MA: ['#C1272D', '#006233'], TN: ['#E70013', '#FFFFFF'], EG: ['#CE1126', '#000000'],
  SN: ['#00853F', '#FDEF42'], CI: ['#F77F00', '#009A44'], GH: ['#006B3F', '#FCD116'],
  KE: ['#006600', '#CC0001'], TZ: ['#1EB53A', '#00A3DD'], RW: ['#20603D', '#FAD201'],
  ET: ['#078930', '#FCDD09'], ZA: ['#007A4D', '#FFB612'], MU: ['#EA2839', '#1A206D'],
  MG: ['#FC3D32', '#007E3A'], CM: ['#007A5E', '#CE1126'], CG: ['#009543', '#FBDE4A'],
  CD: ['#007FFF', '#F7D618'], NG: ['#008751', '#FFFFFF'], AO: ['#CC0000', '#000000'],
  TH: ['#A51931', '#2D2A4A'], VN: ['#DA251D', '#FFCD00'], JP: ['#BC002D', '#FFFFFF'],
  ID: ['#CE1126', '#FFFFFF'], KG: ['#E8112D', '#FFCB00'], UZ: ['#1EB53A', '#CE1126'],
  KH: ['#032EA1', '#E00025'], LK: ['#8D153A', '#DF7A00'], PH: ['#0038A8', '#CE1126'],
  MY: ['#CC0001', '#003893'], SG: ['#EF3340', '#FFFFFF'], MM: ['#FECB00', '#34B233'],
  NP: ['#003893', '#DC143C'], IN: ['#FF9933', '#138808'], KZ: ['#00AFCA', '#FFCD00'],
  MX: ['#006847', '#CE1126'], CO: ['#FCD116', '#003087'], PE: ['#D91023', '#FFFFFF'],
  EC: ['#FFD100', '#003087'], BO: ['#D52B1E', '#007A3D'], PY: ['#D52B1E', '#0038A8'],
  UY: ['#FFFFFF', '#75AADB'], GT: ['#4997D0', '#FFFFFF'], CR: ['#002B7F', '#CE1126'],
  PA: ['#FFFFFF', '#003580'], CU: ['#002A8F', '#CF142B'], DO: ['#002D62', '#CF0921'],
  BR: ['#009C3B', '#FFDF00'], AR: ['#74ACDF', '#FFFFFF'], CL: ['#D52B1E', '#003087'],
  JO: ['#007A3D', '#CE1126'], AE: ['#00732F', '#FF0000'], OM: ['#DB161B', '#009A44'],
};

// Couleur de fond par défaut si pays non listé
const DEFAULT_COLORS: [string, string] = ['#1a1a3a', '#2a2a5a'];

export function getFlagUrl(code: string): string {
  // flagcdn.com — CDN gratuit, drapeaux SVG pour tous les ISO-2
  return `https://flagcdn.com/w320/${code.toLowerCase()}.png`;
}

export function getFlagUrlLarge(code: string): string {
  return `https://flagcdn.com/w640/${code.toLowerCase()}.png`;
}

export function getCountryColors(code: string): [string, string] {
  return COUNTRY_COLORS[code] ?? DEFAULT_COLORS;
}

// Compatibilité avec l'ancien code qui appelle getCountryPhotoUrl
export function getCountryPhotoUrl(code: string, _width = 800, _height = 300): string {
  return getFlagUrl(code);
}

export function getCountryPhotoUrlLarge(code: string): string {
  return getFlagUrlLarge(code);
}

// Garde WIKI_NAME exporté pour ne pas casser les imports existants
export const WIKI_NAME: Record<string, string> = {
  PT: 'Portugal',        GE: 'Georgia_(country)',  AL: 'Albania',
  RS: 'Serbia',          BA: 'Bosnia_and_Herzegovina', MD: 'Moldova',
  MK: 'North_Macedonia', AM: 'Armenia',             TR: 'Turkey',
  ME: 'Montenegro',      XK: 'Kosovo',              GR: 'Greece',
  HR: 'Croatia',         HU: 'Hungary',             MA: 'Morocco',
  TN: 'Tunisia',         EG: 'Egypt',               SN: 'Senegal',
  CI: 'Ivory_Coast',     GH: 'Ghana',               KE: 'Kenya',
  TZ: 'Tanzania',        RW: 'Rwanda',              ET: 'Ethiopia',
  ZA: 'South_Africa',    MU: 'Mauritius',           MG: 'Madagascar',
  CM: 'Cameroon',        CG: 'Republic_of_the_Congo', CD: 'Democratic_Republic_of_the_Congo',
  NG: 'Nigeria',         AO: 'Angola',              TH: 'Thailand',
  VN: 'Vietnam',         JP: 'Japan',               ID: 'Indonesia',
  KG: 'Kyrgyzstan',      UZ: 'Uzbekistan',          KH: 'Cambodia',
  LK: 'Sri_Lanka',       PH: 'Philippines',         MY: 'Malaysia',
  SG: 'Singapore',       MM: 'Myanmar',             NP: 'Nepal',
  IN: 'India',           KZ: 'Kazakhstan',          MX: 'Mexico',
  CO: 'Colombia',        PE: 'Peru',                EC: 'Ecuador',
  BO: 'Bolivia',         PY: 'Paraguay',            UY: 'Uruguay',
  GT: 'Guatemala',       CR: 'Costa_Rica',          PA: 'Panama',
  CU: 'Cuba',            DO: 'Dominican_Republic',  BR: 'Brazil',
  AR: 'Argentina',       CL: 'Chile',               JO: 'Jordan',
  AE: 'United_Arab_Emirates', OM: 'Oman',
};
