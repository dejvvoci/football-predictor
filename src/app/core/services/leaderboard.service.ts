import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, query, orderBy, limit, where } from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { UserProfile } from '../models/user.model';
import { GroupScore } from '../models/group.model';

export interface UserProfileWithAllTime extends UserProfile {
  allTimePoints: number;
}

@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  private firestore = inject(Firestore);

  /** Renditja e sezonit AKTUAL (totalPoints — resetohet kur mbyllet sezoni) */
  getGlobalLeaderboard(): Observable<UserProfile[]> {
    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, orderBy('totalPoints', 'desc'), limit(50));
    return collectionData(q, { idField: 'uid' }) as Observable<UserProfile[]>;
  }

  /**
   * Renditja e gjithë kohërave — lifetimeTotalPoints (sezone të mbyllura) + totalPoints
   * (sezoni aktual, në vazhdim). Rendisim në klient sepse s'është fushë e mirëmbajtur/
   * e indeksueshme te Firestore — app i vogël, numër i vogël userash, pa problem.
   */
  getAllTimeLeaderboard(): Observable<UserProfileWithAllTime[]> {
    const usersRef = collection(this.firestore, 'users');
    return (collectionData(usersRef, { idField: 'uid' }) as Observable<UserProfile[]>).pipe(
      map((users) =>
        [...users]
          .map((u) => ({ ...u, allTimePoints: (u.lifetimeTotalPoints ?? 0) + (u.totalPoints ?? 0) }))
          .sort((a, b) => b.allTimePoints - a.allTimePoints)
          .slice(0, 50)
      )
    );
  }

  getGroupLeaderboard(groupId: string): Observable<GroupScore[]> {
    const scoresRef = collection(this.firestore, 'groupScores');
    const q = query(scoresRef, where('groupId', '==', groupId), orderBy('points', 'desc'));
    return collectionData(q) as Observable<GroupScore[]>;
  }
}