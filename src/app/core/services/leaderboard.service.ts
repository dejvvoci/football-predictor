import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, query, orderBy, limit } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { UserProfile } from '../models/user.model';
import { GroupScore } from '../models/group.model';

/**
 * Leaderboard-i i grupeve implementohet plotësisht në hapin "GroupService + grupet private".
 */
@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  private firestore = inject(Firestore);

  getGlobalLeaderboard(): Observable<UserProfile[]> {
    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, orderBy('totalPoints', 'desc'), limit(50));
    return collectionData(q, { idField: 'uid' }) as Observable<UserProfile[]>;
  }

  getGroupLeaderboard(groupId: string): Observable<GroupScore[]> {
    throw new Error('TODO: query mbi groupScores where groupId == ..., orderBy points desc');
  }
}