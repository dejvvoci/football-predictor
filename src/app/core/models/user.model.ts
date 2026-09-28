export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  username?: string;   // vetëm për llogaritë e regjistruara me username (jo email)
  totalPoints: number;          // pikët e sezonit AKTUAL — resetohet në 0 kur mbyllet sezoni
  lifetimeTotalPoints?: number; // shuma e akumuluar e sezoneve të mbyllura (pa sezonin aktual)
  tournamentPoints: number;
  groupIds: string[];
  currentStreak: number;
  bestStreak: number;
  achievements: string[];
  isAdmin?: boolean;
  createdAt: number;
}