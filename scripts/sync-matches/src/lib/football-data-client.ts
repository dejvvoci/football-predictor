import { FREE_COMPETITIONS } from './competition-map';

export interface FootballDataMatch {
  id: number;
  utcDate: string;
  status: string;
  stage: string;      // GROUP_STAGE | LAST_16 | QUARTER_FINALS | SEMI_FINALS | FINAL | etc.
  group?: string;     // "Group A" | "Group B" | ... (vetëm për GROUP_STAGE)
  venue?: string | null;
  competition: { code: string; name: string };
  homeTeam: { name: string; crest?: string | null };
  awayTeam: { name: string; crest?: string | null };
  score: {
    winner: string | null;       // HOME_TEAM | AWAY_TEAM | DRAW | null
    duration: string;            // REGULAR | EXTRA_TIME | PENALTY_SHOOTOUT
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
    penalties?: { home: number | null; away: number | null };
  };
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Merr statusin e kartës së kuqe për një ndeshje specifike.
 * Kërkon 1 thirrje shtesë API per ndeshje të graduara — brenda limitit 10 req/min.
 * Kthen true/false/null (null = data nuk ishte e disponueshme).
 */
export interface MatchDetails {
  hasRedCard: boolean | null;
  firstGoalscorer: string | null;
}

export async function fetchMatchDetails(matchId: number, token: string): Promise<MatchDetails> {
  try {
    const res = await fetch(`https://api.football-data.org/v4/matches/${matchId}`, {
      headers: { 'X-Auth-Token': token }
    });
    if (!res.ok) return { hasRedCard: null, firstGoalscorer: null };
    const data = await res.json();

    // Red card
    const bookings: Array<{ card: string }> = data.bookings ?? [];
    const hasRedCard = bookings.some((b) => b.card === 'RED' || b.card === 'YELLOW_RED');

    // First goalscorer — sort goals by minute, pick first
    const goals: Array<{ minute: number; scorer?: { name: string }; type?: string }> = data.goals ?? [];
    const regularGoals = goals
      .filter(g => g.type !== 'OWN_GOAL') // exclude own goals
      .sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999));
    const firstGoalscorer = regularGoals[0]?.scorer?.name ?? null;

    return { hasRedCard, firstGoalscorer };
  } catch {
    return { hasRedCard: null, firstGoalscorer: null };
  }
}

// Keep old export for backward compat
export async function fetchMatchRedCardStatus(matchId: number, token: string): Promise<boolean | null> {
  const details = await fetchMatchDetails(matchId, token);
  return details.hasRedCard;
}
/*
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