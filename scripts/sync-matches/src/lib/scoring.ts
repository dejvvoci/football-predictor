export type PredictionChoice = '1' | 'X' | '2';

export interface MatchOdds {
  home: number;
  draw: number;
  away: number;
}

export interface OverUnderOdds {
  over: number;
  under: number;
  line: number;
}

export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
}

export interface ExactScoreGuess {
  home: number;
  away: number;
}

/** Rezultati real i ndeshjes, kthyer si '1' | 'X' | '2' */
export function getOutcome(result: MatchResult): PredictionChoice {
  if (result.homeGoals > result.awayGoals) return '1';
  if (result.homeGoals < result.awayGoals) return '2';
  return 'X';
}

/** Pikët e 1/X/2 + exact score bonus */
export function calculatePoints(
  choice: PredictionChoice,
  exactScore: ExactScoreGuess | undefined,
  odds: MatchOdds,
  result: MatchResult
): number {
  let points = 0;
  const actualOutcome = getOutcome(result);

  if (choice === actualOutcome) {
    const odd = choice === '1' ? odds.home : choice === 'X' ? odds.draw : odds.away;
    points += Math.floor(odd);
  }

  if (exactScore && exactScore.home === result.homeGoals && exactScore.away === result.awayGoals) {
    points += 3;
  }

  return points;
}

/** Pikët e over/under — floor(odds) nëse e qëllove */
export function calculateOverUnderPoints(
  choice: 'over' | 'under',
  ouOdds: OverUnderOdds,
  result: MatchResult
): number {
  const totalGoals = result.homeGoals + result.awayGoals;
  const isOver = totalGoals > ouOdds.line;
  const isCorrect = (choice === 'over') === isOver;
  if (!isCorrect) return 0;
  return Math.floor(choice === 'over' ? ouOdds.over : ouOdds.under);
}