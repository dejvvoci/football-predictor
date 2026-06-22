import { COMPETITION_TO_SPORT_KEY } from './competition-map';

export interface OverUnderOdds {
  over: number;
  under: number;
  line: number; // tipikisht 2.5
}

export interface OddsEntry {
  home: number;
  draw: number;
  away: number;
  overUnder?: OverUnderOdds;
}

interface OddsApiOutcome {
  name: string;
  price: number;
  point?: number; // linja e over/under (p.sh. 2.5)
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

export function matchKey(homeTeam: string, awayTeam: string): string {
  return `${normalize(homeTeam)}__${normalize(awayTeam)}`;
}

/**
 * Merr h2h (1/X/2) + totals (over/under) për TË GJITHA ndeshjet e ardhshme —
 * gjithmonë 1 thirrje API (h2h,totals në të njëjtën kërkesë).
 */
export async function fetchOddsForCompetition(
  apiKey: string,
  competitionCode: string
): Promise<Map<string, OddsEntry>> {
  const oddsByMatch = new Map<string, OddsEntry>();
  const sportKey = COMPETITION_TO_SPORT_KEY[competitionCode];
  if (!sportKey) return oddsByMatch;

  const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${apiKey}&regions=eu&markets=h2h,totals&oddsFormat=decimal`;
  const res = await fetch(url);

  if (!res.ok) {
    console.warn(`the-odds-api.com error për ${competitionCode}: ${res.status}`);
    return oddsByMatch;
  }

  const events = (await res.json()) as OddsApiEvent[];

  for (const event of events) {
    const bookmaker = event.bookmakers?.[0];
    if (!bookmaker) continue;

    const h2hMarket = bookmaker.markets?.find((m) => m.key === 'h2h');
    const totalsMarket = bookmaker.markets?.find((m) => m.key === 'totals');

    const home = h2hMarket?.outcomes.find((o) => normalize(o.name) === normalize(event.home_team))?.price;
    const away = h2hMarket?.outcomes.find((o) => normalize(o.name) === normalize(event.away_team))?.price;
    const draw = h2hMarket?.outcomes.find((o) => normalize(o.name) === 'draw')?.price;

    if (!home || !away || !draw) continue;

    let overUnder: OverUnderOdds | undefined;
    if (totalsMarket) {
      const overOutcome  = totalsMarket.outcomes.find((o) => o.name.toLowerCase() === 'over');
      const underOutcome = totalsMarket.outcomes.find((o) => o.name.toLowerCase() === 'under');
      if (overOutcome && underOutcome && overOutcome.point !== undefined) {
        overUnder = {
          over: overOutcome.price,
          under: underOutcome.price,
          line: overOutcome.point
        };
      }
    }

    oddsByMatch.set(matchKey(event.home_team, event.away_team), {
      home, draw, away, ...(overUnder ? { overUnder } : {})
    });
  }

  return oddsByMatch;
}