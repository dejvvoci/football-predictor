import { FootballDataMatch } from './football-data-client';

/**
 * TheSportsDB — burim shtesë FALAS për ndeshje kombëtaresh që football-data.org
 * s'i mbulon (Nations League tani; Euro/WC Qualifiers, Copa America, AFCON më vonë,
 * thjesht duke shtuar hyrje të reja te THESPORTSDB_LEAGUES).
 *
 * "123" është çelësi publik i testimit i vetë TheSportsDB (jo sekret, i njëjtë për
 * këdo në planin falas) — dokumentuar te thesportsdb.com/documentation.
 *
 * Ndeshjet e sjella këtej PËRSHTATEN si FootballDataMatch dhe kalojnë nëpër të
 * njëjtin loop ekzistues të sync-logic.ts (upsert, gradim, etj.) — pa dublikuar
 * logjikë. Qëllimisht s'u vendoset 'stage', kështu që s'trigger-ojnë asnjëherë
 * krijimin automatik të sfidave "Tournament" apo bracket-eve (ato mbeten specifike
 * për kompeticionet e football-data.org).
 */
const THESPORTSDB_BASE = 'https://www.thesportsdb.com/api/v1/json/123';

export interface TheSportsDbLeague {
  id: string;    // idLeague te TheSportsDB
  code: string;  // kod sintetik i brendshëm ynë (s'ekziston te asnjë API real)
  name: string;
}

export const THESPORTSDB_LEAGUES: TheSportsDbLeague[] = [
  { id: '4490', code: 'NL', name: 'UEFA Nations League' }
  // Më vonë: Euro Qualifiers, WC Qualifiers, Copa America (4499), AFCON (4496) —
  // AFCON/Copa America duhen verifikuar sezon-për-sezon me eventsseason.php meqë
  // s'kanë ndeshje çdo vit (turne periodike, jo liga vjetore si Nations League).
];

interface TheSportsDbEvent {
  idEvent: string;
  strLeague: string;
  strHomeTeam: string | null;
  strAwayTeam: string | null;
  strHomeTeamBadge: string | null;
  strAwayTeamBadge: string | null;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strTimestamp: string | null; // "YYYY-MM-DDTHH:MM:SS", UTC (pa 'Z')
  strVenue: string | null;
  strStatus: string | null; // "NS" | "FT" | "1H" | "2H" | "HT" | "AET" | "FT_PEN" | ...
}

function mapTheSportsDbStatus(status: string | null): string {
  switch (status) {
    case 'FT':
    case 'AET':
    case 'FT_PEN':
      return 'FINISHED';
    case '1H':
    case '2H':
    case 'ET':
      return 'IN_PLAY';
    case 'HT':
      return 'PAUSED';
    default:
      return 'SCHEDULED';
  }
}

async function fetchEvents(path: string): Promise<TheSportsDbEvent[]> {
  try {
    const res = await fetch(`${THESPORTSDB_BASE}/${path}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { events: TheSportsDbEvent[] | null };
    return data.events ?? [];
  } catch (e) {
    console.warn(`TheSportsDB fetch failed for ${path}:`, e);
    return [];
  }
}

/** Ndeshjet (të ardhshme + së fundmi të luajtura, bashkuara pa dublikime) e një ligë, si FootballDataMatch */
export async function fetchLeagueMatches(league: TheSportsDbLeague): Promise<FootballDataMatch[]> {
  const [next, past] = await Promise.all([
    fetchEvents(`eventsnextleague.php?id=${league.id}`),
    fetchEvents(`eventspastleague.php?id=${league.id}`)
  ]);

  const seen = new Set<string>();
  const events = [...next, ...past].filter((e) => {
    if (seen.has(e.idEvent)) return false;
    seen.add(e.idEvent);
    return true;
  });

  return events
    .filter((e) => e.strHomeTeam && e.strAwayTeam && e.strTimestamp)
    .map(
      (e): FootballDataMatch => ({
        id: Number(`9${e.idEvent}`), // parashtesë "9" — s'përplaset kurrë me ID-të numerike të football-data.org
        utcDate: `${e.strTimestamp}Z`,
        status: mapTheSportsDbStatus(e.strStatus),
        stage: '', // qëllimisht bosh — mos u trigger-o krijimi automatik i sfidave/bracket-eve
        venue: e.strVenue ?? undefined,
        competition: { code: league.code, name: league.name },
        homeTeam: { name: e.strHomeTeam as string, crest: e.strHomeTeamBadge ?? undefined },
        awayTeam: { name: e.strAwayTeam as string, crest: e.strAwayTeamBadge ?? undefined },
        score: {
          winner: null,
          duration: 'REGULAR',
          fullTime: {
            home: e.intHomeScore !== null && e.intHomeScore !== '' ? Number(e.intHomeScore) : null,
            away: e.intAwayScore !== null && e.intAwayScore !== '' ? Number(e.intAwayScore) : null
          },
          halfTime: { home: null, away: null } // TheSportsDB s'jep rezultatin e pjesës së parë falas
        }
      })
    );
}

/** Sjell ndeshjet e të gjitha ligave të konfiguruara (thirrje paralele, secila e mbrojtur nga gabime) */
export async function fetchAllTheSportsDbMatches(): Promise<FootballDataMatch[]> {
  const results = await Promise.all(
    THESPORTSDB_LEAGUES.map((league) =>
      fetchLeagueMatches(league).catch((e) => {
        console.warn(`TheSportsDB: failed to fetch ${league.name}:`, e);
        return [] as FootballDataMatch[];
      })
    )
  );
  return results.flat();
}
