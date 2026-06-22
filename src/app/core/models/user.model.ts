export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  totalPoints: number;
  totalCorrect: number;    // parashikime 1/X/2 të sakta (për arritjet)
  currentStreak: number;   // streak aktual radhazi
  bestStreak: number;      // streaku historik më i mirë
  achievements: string[];  // lista e arritjeve të fituara (IDs)
  groupIds: string[];      // pa kufi grupesh
  createdAt: number;
}
