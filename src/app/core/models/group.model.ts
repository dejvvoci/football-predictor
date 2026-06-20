export interface Group {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string;
  memberIds: string[];
  createdAt: number;
}

export interface GroupScore {
  groupId: string;
  userId: string;
  displayName: string;
  points: number;
}

export interface GroupPrediction {
  id: string;            // `${groupId}_${userId}_${matchId}`
  groupId: string;
  userId: string;
  matchId: string;
  choice: '1' | 'X' | '2';
  exactScore?: { home: number; away: number };
  points?: number;       // plotësohet pasi mbaron ndeshja
  createdAt: number;
}