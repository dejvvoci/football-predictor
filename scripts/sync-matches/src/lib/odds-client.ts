import { COMPETITION_TO_SPORT_KEY } from './competition-map';

export interface OddsEntry {
  home: number;
  draw: number;
  away: number;
}

interface OddsApiOutcome {
  name: string;
  price: number;
}

interface OddsApiMarket {
  key: string;
  outcomes: OddsApiOutcome[];
}

interface OddsApiBookmaker {
  markets: OddsApiMarket[];
}

interface OddsApiEvent {
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

/** Çelësi i përdorur për të përputhur ndeshjet mes football-data.org dhe the-odds-api.com */
export function matchKey(homeTeam: string, awayTeam: string): string {
  return `${normalize(homeTeam)}__${normalize(awayTeam)}`;
}

/**
 * Merr koeficentët h2h (1/X/2) për TË GJITHA ndeshjet e ardhshme të një kompeticioni
 * me 1 thirrje API (jo një thirrje për ndeshje — kjo ruan kuotën mujore prej 500).
 */
export async function fetchOddsForCompetition(
  apiKey: string,
  competitionCode: string
): Promise<Map<string, OddsEntry>> {
  const oddsByMatch = new Map<string, OddsEntry>();
  const sportKey = COMPETITION_TO_SPORT_KEY[competitionCode];
  if (!sportKey) return oddsByMatch;

  const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${apiKey}&regions=eu&markets=h2h&oddsFormat=decimal`;
  const res = await fetch(url);

  if (!res.ok) {
    console.warn(`the-odds-api.com error për ${competitionCode}: ${res.status}`);
    return oddsByMatch;
  }

  const events = (await res.json()) as OddsApiEvent[];

  for (const event of events) {
    const market = event.bookmakers?.[0]?.markets?.find((m) => m.key === 'h2h');
    if (!market) continue;

    const home = market.outcomes.find((o) => normalize(o.name) === normalize(event.home_team))?.price;
    const away = market.outcomes.find((o) => normalize(o.name) === normalize(event.away_team))?.price;
    const draw = market.outcomes.find((o) => normalize(o.name) === 'draw')?.price;

    if (home && away && draw) {
      oddsByMatch.set(matchKey(event.home_team, event.away_team), { home, draw, away });
    }
  }

  return oddsByMatch;
}