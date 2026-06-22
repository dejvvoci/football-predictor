export interface Season {
  id: string;
  name: string;
  startedAt: number;
  endedAt?: number;
  isActive: boolean;
}

export interface HallOfFameEntry {
  id: string;          // `${seasonId}_${userId}`
  seasonId: string;
  userId: string;
  displayName: string;
  totalPoints: number;
  rank: number;
  achievements: string[];
}