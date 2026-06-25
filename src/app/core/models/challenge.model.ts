export type ChallengeType = 'player' | 'badge' | 'career' | 'transfer';

// ── Badge ──
export interface BadgeChallengeData {
  teamId: number;
  teamName: string;
  crest: string;
  competition: string;
  country: string;
  founded?: number;
  venue?: string;
}

// ── Career Path ──
export interface CareerPathData {
  playerName: string;
  clubs: string[];
  nationality: string;
}

// ── Transfer Quiz ──
export interface TransferQuizData {
  player: string;
  from: string;
  to: string;
  year: number;
  fee: number;
}

export interface DailyChallengeV2<T = BadgeChallengeData | CareerPathData | TransferQuizData> {
  id: string;       // `{date}_{type}`
  type: ChallengeType;
  date: string;
  data: T;
  createdAt: number;
}

export interface ChallengeResult {
  id: string;       // `{date}_{type}_{userId}`
  type: ChallengeType;
  date: string;
  userId: string;
  displayName: string;
  solved: boolean;
  attempts: number;
  solvedInSeconds: number;
  createdAt: number;
}
