export type PredictionChoice = '1' | 'X' | '2';

export interface MatchOdds {
  home: number;
  draw: number;
  away: number;
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

/**
 * Formula e pikëve (e njëjtë me atë të diskutuar):
 * - Qëllove 1/X/2 → floor(koeficenti i atij rezultati)
 * - Qëllove edhe rezultatin e saktë → +3 pikë bonus
 */
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