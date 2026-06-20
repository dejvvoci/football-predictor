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
