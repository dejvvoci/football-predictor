export type PredictionChoice = '1' | 'X' | '2';

export interface ExactScoreGuess {
  home: number;
  away: number;
}

export interface Prediction {
  id: string;
  userId: string;
  matchId: string;
  choice: PredictionChoice;
  exactScore?: ExactScoreGuess;
  points?: number;
  overUnder?: 'over' | 'under';
  ouPoints?: number;
  htFt?: string;        // p.sh. "1/X", "X/2", "2/1" — HT rezultati / FT rezultati
  htFtPoints?: number;  // +5 nëse e qëllove
  seen?: boolean;
  competition?: string;
  exactScoreCorrect?: boolean;
  createdAt: number;
}