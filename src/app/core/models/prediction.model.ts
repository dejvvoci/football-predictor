export type PredictionChoice = '1' | 'X' | '2';

export interface ExactScoreGuess {
  home: number;
  away: number;
}

export interface Prediction {
  id: string;            // `${userId}_${matchId}`
  userId: string;
  matchId: string;
  choice: PredictionChoice;
  exactScore?: ExactScoreGuess;
  points?: number;       // plotësohet pasi mbaron ndeshja
  createdAt: number;
}
