export type PredictionChoice = '1' | 'X' | '2';

export interface ExactScoreGuess {
  home: number;
  away: number;
}

export interface Prediction {
  id: string;                   // `${userId}_${matchId}`
  userId: string;
  matchId: string;
  choice: PredictionChoice;
  exactScore?: ExactScoreGuess;
  points?: number;              // plotësohet pasi mbaron ndeshja (1/X/2 + exact score)
  overUnder?: 'over' | 'under'; // parashikimi opsional i totalit të golave
  ouPoints?: number;            // pikët e over/under (ruhen ndaras)
  seen?: boolean;
  competition?: string;
  exactScoreCorrect?: boolean;
  createdAt: number;
}