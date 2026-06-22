export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  totalPoints: number;
  tournamentPoints: number;
  groupIds: string[];
  currentStreak: number;
  bestStreak: number;
  achievements: string[];
  isAdmin?: boolean;
  createdAt: number;
}