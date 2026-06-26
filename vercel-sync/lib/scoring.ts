export interface MatchResult { homeGoals: number; awayGoals: number; }
export interface MatchOdds { home: number; draw: number; away: number; }
export interface OverUnderOdds { line: number; over: number; under: number; }
export type PredictionChoice = '1' | 'X' | '2';
export interface ExactScoreGuess { home: number; away: number; }

function getOutcome(r: MatchResult): PredictionChoice {
  if (r.homeGoals > r.awayGoals) return '1';
  if (r.homeGoals < r.awayGoals) return '2';
  return 'X';
}

export function calculatePoints(
  choice: PredictionChoice,
  exactScore: ExactScoreGuess | undefined,
  odds: MatchOdds,
  result: MatchResult
): number {
  const actual = getOutcome(result);
  if (choice !== actual) return 0;
  const oddsValue = choice === '1' ? odds.home : choice === '2' ? odds.away : odds.draw;
  const base = Math.floor(oddsValue);
  if (!exactScore) return base;
  const exactCorrect = exactScore.home === result.homeGoals && exactScore.away === result.awayGoals;
  return base + (exactCorrect ? 5 : 0);
}

export function calculateOverUnderPoints(
  choice: 'over' | 'under',
  ouOdds: OverUnderOdds,
  result: MatchResult
): number {
  const total = result.homeGoals + result.awayGoals;
  const actual = total > ouOdds.line ? 'over' : 'under';
  return choice === actual ? Math.floor(choice === 'over' ? ouOdds.over : ouOdds.under) : 0;
}

export function calculateHtFtPoints(
  choice: string,
  halfTime: MatchResult,
  fullTime: MatchResult
): number {
  const ht = getOutcome(halfTime);
  const ft = getOutcome(fullTime);
  return choice === `${ht}/${ft}` ? 5 : 0;
}

export function calculateBttsPoints(choice: boolean, result: MatchResult): number {
  return choice === (result.homeGoals > 0 && result.awayGoals > 0) ? 1 : 0;
}

export function calculateRedCardPoints(choice: boolean, hasRedCard: boolean): number {
  return (choice === true && hasRedCard === true) ? 3 : 0;
}
