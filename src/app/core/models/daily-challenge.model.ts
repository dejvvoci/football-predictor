export interface DailyPlayer {
  id: string;
  name: string;
  nationality: string;
  nationalityEmoji: string;
  position: string;          // Forward, Midfielder, Defender, Goalkeeper
  club: string;
  birthYear: number;
  thumbnail?: string;        // URL nga TheSportsDB
  source: 'api' | 'fallback';
}

export interface DailyChallenge {
  id: string;              // YYYY-MM-DD
  date: string;
  player: DailyPlayer;
  createdAt: number;
}

export interface DailyChallengeResult {
  id: string;              // `${date}_${userId}`
  date: string;
  userId: string;
  displayName: string;
  solved: boolean;
  attempts: number;        // 1–6
  solvedInSeconds: number;
  createdAt: number;
}