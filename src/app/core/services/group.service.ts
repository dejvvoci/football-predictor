import { Injectable, inject } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Observable } from 'rxjs';
import { Group } from '../models/group.model';

/**
 * Implementohet plotësisht në hapin "GroupService + grupet private (max 3)".
 * Krijimi/anëtarësimi validohet nga Cloud Function `joinGroup`
 * (limiti prej 3 grupesh nuk mund t'i besohet vetëm frontend-it).
 */
@Injectable({ providedIn: 'root' })
export class GroupService {
  private firestore = inject(Firestore);
  private functions = inject(Functions);

  createGroup(name: string): Promise<unknown> {
    throw new Error('TODO: addDoc mbi groups + gjenerimi i inviteCode');
  }

  joinGroup(inviteCode: string): Promise<unknown> {
    const callable = httpsCallable(this.functions, 'joinGroup');
    return callable({ inviteCode });
  }

  getUserGroups(userId: string): Observable<Group[]> {
    throw new Error('TODO: query mbi groups where memberIds array-contains userId');
  }

  getGroup(groupId: string): Observable<Group | undefined> {
    throw new Error('TODO: docData mbi groups/{groupId}');
  }
}
