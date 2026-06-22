import { FREE_COMPETITIONS } from './competition-map';

export interface FootballDataMatch {
  id: number;
  utcDate: string;
  status: string;
  stage: string;      // GROUP_STAGE | ROUND_OF_16 | QUARTER_FINALS | SEMI_FINALS | FINAL | etc.
  group?: string;     // "Group A" | "Group B" | ... (vetëm për GROUP_STAGE)
  venue?: string | null;
  competition: { code: string; name: string };
  homeTeam: { name: string; crest?: string | null };
  awayTeam: { name: string; crest?: string | null };
  score: {
    fullTime: { home: number | null; away: number | null };
  };
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Ndeshjet "sot + nesër" (UTC) për 12 kompeticionet e planit falas — 1 thirrje API.
 * E marrim me 1 ditë paraprirje (jo vetëm "sot", default i football-data.org), që ndeshjet
 * afër mesnatës të zbulohen me orë paraprijëse, jo vetëm minuta para fillimit.
 */
export async function fetchUpcomingMatches(token: string): Promise<FootballDataMatch[]> {
  const today = new Date();
  const rangeEnd = new Date(today.getTime() + 48 * 60 * 60 * 1000); // +48h (jo +24h) — buferr shtesë kundër rasteve kufitare të datave

  const dateFrom = formatDate(today);
  const dateTo = formatDate(rangeEnd);

  const url = `https://api.football-data.org/v4/matches?competitions=${FREE_COMPETITIONS.join(',')}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
  const res = await fetch(url, { headers: { 'X-Auth-Token': token } });

  if (!res.ok) {
    throw new Error(`football-data.org error: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { matches: FootballDataMatch[] };
  return data.matches;
}