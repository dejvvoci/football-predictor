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

export const HT_FT_BONUS = 5;
export const RED_CARD_BONUS = 3;
export const BTTS_BONUS = 1;
export const FIRST_GOALSCORER_BONUS = 4;

/** First goalscorer — fuzzy match (last name is enough) */
export function calculateFirstGoalscorerPoints(prediction: string, actual: string): number {
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const np = norm(prediction);
  const na = norm(actual);
  if (!np || !na) return 0;
  const lastName = na.split(' ').at(-1) ?? na;
  const predLast = np.split(' ').at(-1) ?? np;
  if (np === na || predLast === lastName || na.includes(np) || np.includes(lastName)) {
    return FIRST_GOALSCORER_BONUS;
  }
  return 0;
}

export function calculateHtFtPoints(
  choice: string,
  halfTimeResult: MatchResult,
  fullTimeResult: MatchResult
): number {
  const htOutcome = getOutcome(halfTimeResult);
  const ftOutcome = getOutcome(fullTimeResult);
  const actual = `${htOutcome}/${ftOutcome}`;
  return choice === actual ? HT_FT_BONUS : 0;
}

/** BTTS: both teams to score. +2 pts if correct. */
export function calculateBttsPoints(choice: boolean, result: MatchResult): number {
  const actual = result.homeGoals > 0 && result.awayGoals > 0;
  return choice === actual ? BTTS_BONUS : 0;
}

/** Red card. +3 pts if correct. */
export function calculateRedCardPoints(choice: boolean, hasRedCard: boolean): number {
  return choice === hasRedCard ? RED_CARD_BONUS : 0;
}