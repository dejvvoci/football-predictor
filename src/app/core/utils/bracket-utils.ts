import { Bracket, BracketMatchup, BracketTeam } from '../models/bracket.model';

interface BuiltBracket {
  rounds: BracketMatchup[][];
  cleanedPicks: Record<string, string>;
}

/**
 * Ndërton çdo rreth pas të parit duke propaguar fituesit e zgjedhur nga useri, dhe në
 * të njëjtën kohë "pastron" picks: nëse një pick i një rrethi të mëparshëm ndryshon,
 * çdo pick i rretheve pasuese që s'përputhet më me ekipet e reja hidhet poshtë —
 * përndryshe do të mbetej një fitues "fantazmë" që s'i takon më asnjë ndeshjeje reale.
 */
function build(bracket: Bracket, rawPicks: Record<string, string>): BuiltBracket {
  const teamsByName = new Map<string, BracketTeam>();
  for (const m of bracket.matchups) {
    teamsByName.set(m.home.name, m.home);
    teamsByName.set(m.away.name, m.away);
  }

  const cleanedPicks: Record<string, string> = {};
  const rounds: BracketMatchup[][] = [];
  let current = [...bracket.matchups].sort((a, b) => a.slotIndex - b.slotIndex);
  rounds.push(current);

  for (const m of current) {
    const p = rawPicks[m.id];
    if (p === m.home.name || p === m.away.name) cleanedPicks[m.id] = p;
  }

  for (let i = 1; i < bracket.rounds.length; i++) {
    const round = bracket.rounds[i];
    const next: BracketMatchup[] = [];

    for (let j = 0; j < current.length; j += 2) {
      const left = current[j];
      const right = current[j + 1];
      const homeName = left ? cleanedPicks[left.id] : undefined;
      const awayName = right ? cleanedPicks[right.id] : undefined;

      const matchup: BracketMatchup = {
        id: `${round}_${j / 2}`,
        round,
        slotIndex: j / 2,
        home: homeName ? (teamsByName.get(homeName) ?? { name: homeName }) : { name: '' },
        away: awayName ? (teamsByName.get(awayName) ?? { name: awayName }) : { name: '' }
      };
      next.push(matchup);

      const p = rawPicks[matchup.id];
      if (p && (p === matchup.home.name || p === matchup.away.name)) cleanedPicks[matchup.id] = p;
    }

    rounds.push(next);
    current = next;
  }

  return { rounds, cleanedPicks };
}

export function buildBracketRounds(bracket: Bracket, picks: Record<string, string>): BracketMatchup[][] {
  return build(bracket, picks).rounds;
}

/** Heq çdo pick "fantazmë" të mbetur nga ndryshimi i një zgjedhjeje të mëparshme */
export function cleanBracketPicks(bracket: Bracket, picks: Record<string, string>): Record<string, string> {
  return build(bracket, picks).cleanedPicks;
}

/** A ka useri zgjedhur një fitues për çdo ndeshje të çdo rrethi (bracket-i i plotë)? */
export function isBracketComplete(bracket: Bracket, picks: Record<string, string>): boolean {
  const { rounds, cleanedPicks } = build(bracket, picks);
  return rounds.every((round) =>
    round.every((matchup) => !!cleanedPicks[matchup.id] && !!matchup.home.name && !!matchup.away.name)
  );
}
