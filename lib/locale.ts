// Country and league defaults. League ids are API-Football ids.
// Adding a market = add its league profile here and map its country/time zone.

export type Derby = { name: string; clubs: string[] };
export type LeagueProfile = {
  id: number;
  name: string;
  country: string; // ISO 3166-1 alpha-2
  timezone: string;
  bigClubs: string[]; // normalized substrings: lowercase, no accents
  derbies: Derby[];
};

export const LEAGUES: Record<number, LeagueProfile> = {
  39: {
    id: 39, name: 'Premier League', country: 'GB', timezone: 'Europe/London',
    bigClubs: ['arsenal', 'chelsea', 'liverpool', 'manchester city', 'manchester united', 'tottenham'],
    derbies: [
      { name: 'North London derby', clubs: ['arsenal', 'tottenham'] },
      { name: 'Manchester derby', clubs: ['manchester city', 'manchester united'] },
      { name: 'Merseyside derby', clubs: ['liverpool', 'everton'] },
    ],
  },
  140: {
    id: 140, name: 'La Liga', country: 'ES', timezone: 'Europe/Madrid',
    bigClubs: ['real madrid', 'barcelona', 'atletico madrid'],
    derbies: [
      { name: 'El Clásico', clubs: ['real madrid', 'barcelona'] },
      { name: 'Madrid derby', clubs: ['real madrid', 'atletico madrid'] },
    ],
  },
  135: {
    id: 135, name: 'Serie A', country: 'IT', timezone: 'Europe/Rome',
    bigClubs: ['inter', 'ac milan', 'juventus', 'napoli', 'roma'],
    derbies: [
      { name: 'Derby della Madonnina', clubs: ['inter', 'ac milan'] },
      { name: 'Derby della Capitale', clubs: ['roma', 'lazio'] },
    ],
  },
  78: {
    id: 78, name: 'Bundesliga', country: 'DE', timezone: 'Europe/Berlin',
    bigClubs: ['bayern', 'dortmund', 'leverkusen', 'leipzig'],
    derbies: [{ name: 'Der Klassiker', clubs: ['bayern', 'dortmund'] }],
  },
  61: {
    id: 61, name: 'Ligue 1', country: 'FR', timezone: 'Europe/Paris',
    bigClubs: ['paris saint germain', 'marseille', 'lyon', 'monaco'],
    derbies: [{ name: 'Le Classique', clubs: ['paris saint germain', 'marseille'] }],
  },
  203: {
    id: 203, name: 'Süper Lig', country: 'TR', timezone: 'Europe/Istanbul',
    bigClubs: ['galatasaray', 'fenerbahce', 'besiktas', 'trabzonspor'],
    derbies: [{ name: 'Istanbul derby', clubs: ['galatasaray', 'fenerbahce', 'besiktas'] }],
  },
  71: {
    id: 71, name: 'Brasileirão Série A', country: 'BR', timezone: 'America/Sao_Paulo',
    bigClubs: ['flamengo', 'palmeiras', 'corinthians', 'sao paulo', 'santos', 'fluminense'],
    derbies: [
      { name: 'Clássico dos Milhões', clubs: ['flamengo', 'vasco'] },
      { name: 'Derby Paulista', clubs: ['palmeiras', 'corinthians'] },
    ],
  },
  253: {
    id: 253, name: 'Major League Soccer', country: 'US', timezone: 'America/New_York',
    bigClubs: ['inter miami', 'la galaxy', 'los angeles fc'],
    derbies: [{ name: 'El Tráfico', clubs: ['la galaxy', 'los angeles fc'] }],
  },
};

const COUNTRY_LEAGUE: Record<string, number> = {
  GB: 39, IE: 39, ES: 140, IT: 135, DE: 78, AT: 78, FR: 61, BE: 61, TR: 203, BR: 71, US: 253, CA: 253,
};
const FALLBACK_LEAGUE = 39;

// Time zone → country. The time zone wins over the reported country: a phone's
// language region (e.g. en-US on a phone in Istanbul) says little about where people live.
const TZ_COUNTRY: Record<string, string> = {
  'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Madrid': 'ES', 'Europe/Rome': 'IT',
  'Europe/Berlin': 'DE', 'Europe/Vienna': 'AT', 'Europe/Paris': 'FR', 'Europe/Brussels': 'BE',
  'Europe/Istanbul': 'TR', 'America/Sao_Paulo': 'BR', 'America/New_York': 'US',
  'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US', 'America/Toronto': 'CA',
};

export function validTimezone(zone: string | undefined): zone is string {
  if (!zone) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(0); return true; } catch { return false; }
}

export function normalizeCountry(value: string | undefined): string | undefined {
  const code = value?.trim().toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) ? code : undefined;
}

/** Defaults for a new group from what the creator's device reports. */
export function groupDefaults(input: { timezone?: string; country?: string }) {
  const zoneOk = validTimezone(input.timezone);
  const country = (zoneOk ? TZ_COUNTRY[input.timezone!] : undefined) || normalizeCountry(input.country);
  const leagueId = (country && COUNTRY_LEAGUE[country]) || FALLBACK_LEAGUE;
  const league = LEAGUES[leagueId];
  return {
    timezone: zoneOk ? input.timezone! : 'UTC', // clients always send one; UTC only for API callers that don't
    country: country || league.country,
    leagues: [leagueId],
  };
}

export function leagueProfile(id: number): LeagueProfile | undefined {
  return LEAGUES[id];
}
