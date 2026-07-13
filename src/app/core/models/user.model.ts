export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  username?: string;   // vetëm për llogaritë e regjistruara me username (jo email)
  totalPoints: number;
  tournamentPoints: number;
  groupIds: string[];
  currentStreak: number;
  bestStreak: number;
  achievements: string[];
  isAdmin?: boolean;
  createdAt: number;
}