export type PredictionChoice = '1' | 'X' | '2';

export interface ExactScoreGuess {
  home: number;
  away: number;
}

export interface Prediction {
  id: string;                  // `${userId}_${matchId}`
  userId: string;
  matchId: string;
  choice: PredictionChoice;
  exactScore?: ExactScoreGuess;
  points?: number;             // 1/X/2 + exact score points
  overUnder?: 'over' | 'under';
  ouPoints?: number;
  htFt?: string;               // e.g. "1/X", "X/2"
  htFtPoints?: number;
  btts?: boolean;              // true = both teams score
  bttsPoints?: number;
  redCard?: boolean;           // true = yes there will be a red card
  redCardPoints?: number;
  firstGoalscorer?: string;    // player name prediction
  firstGoalscorerPoints?: number;
  seen?: boolean;
  competition?: string;
  exactScoreCorrect?: boolean;
  createdAt: number;
  saved?: boolean;              // i ruajtur nga useri, mbijeton resetimin e fund-sezonit
}