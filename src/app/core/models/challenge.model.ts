export type ChallengeType = 'player' | 'badge' | 'flashback' | 'topscorer';

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

// ── Score Flashback ──
export interface FlashbackData {
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  htHomeGoals?: number;
  htAwayGoals?: number;
  competition: string;
  season: string;
  stage: string;
  matchDate: string;
}

// ── Top Scorer ──
export interface TopScorerData {
  playerName: string;
  team: string;
  nationality?: string;
  goals: number;
  competition: string;
  competitionCode: string;
  season: number;
}

export interface DailyChallengeV2<T = BadgeChallengeData | FlashbackData | TopScorerData> {
  id: string;
  type: ChallengeType;
  date: string;
  data: T;
  createdAt: number;
}

export interface ChallengeResult {
  id: string;
  type: ChallengeType;
  date: string;
  userId: string;
  displayName: string;
  solved: boolean;
  attempts: number;
  solvedInSeconds: number;
  createdAt: number;
}