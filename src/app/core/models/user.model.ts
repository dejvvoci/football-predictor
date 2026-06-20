export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  totalPoints: number;
  groupIds: string[]; // max 3 elementë
  createdAt: number;
}
