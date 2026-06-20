import { Injectable, inject } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { UserProfile } from '../models/user.model';
import { GroupScore } from '../models/group.model';

/**
 * Implementohet plotësisht në hapin "LeaderboardService + tabela e renditjes".
 */
@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  private firestore = inject(Firestore);

  getGlobalLeaderboard(): Observable<UserProfile[]> {
    throw new Error('TODO: query mbi users, orderBy totalPoints desc');
  }

  getGroupLeaderboard(groupId: string): Observable<GroupScore[]> {
    throw new Error('TODO: query mbi groupScores where groupId == ..., orderBy points desc');
  }
}
