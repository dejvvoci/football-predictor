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
  seen?: boolean;        // false menjëherë pas gradimit; true pasi i shfaqet popup-i userit
  createdAt: number;
}