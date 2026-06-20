import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  query,
  where,
  limit,
  getDocs,
  runTransaction,
  arrayUnion,
  documentId
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, of } from 'rxjs';
import { Group } from '../models/group.model';
import { UserProfile } from '../models/user.model';

const MAX_GROUPS = 3;
const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // pa O/0, I/1 — shmang ngatërrime vizuale

function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
  }
  return code;
}

@Injectable({ providedIn: 'root' })
export class GroupService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  /** Krijon grup të ri; hedh error nëse useri ka arritur limitin prej 3 grupesh */
  async createGroup(name: string): Promise<string> {
    const userId = this.requireUserId();

    return runTransaction(this.firestore, async (tx) => {
      const userRef = doc(this.firestore, 'users', userId);
      const userSnap = await tx.get(userRef);
      const groupIds: string[] = (userSnap.data()?.['groupIds'] as string[]) ?? [];

      if (groupIds.length >= MAX_GROUPS) {
        throw new Error(`Ke arritur limitin prej ${MAX_GROUPS} grupesh.`);
      }

      const groupRef = doc(collection(this.firestore, 'groups'));

      tx.set(groupRef, {
        name,
        ownerId: userId,
        inviteCode: generateInviteCode(),
        memberIds: [userId],
        createdAt: Date.now()
      });

      tx.update(userRef, { groupIds: arrayUnion(groupRef.id) });

      return groupRef.id;
    });
  }

  /** Anëtarësim me kod ftese; hedh error nëse kodi është i pavlefshëm, je tashmë anëtar, ose ke arritur limitin */
  async joinGroup(inviteCode: string): Promise<string> {
    const userId = this.requireUserId();

    const groupsRef = collection(this.firestore, 'groups');
    const q = query(groupsRef, where('inviteCode', '==', inviteCode.trim().toUpperCase()), limit(1));
    const matchingGroups = await getDocs(q);

    if (matchingGroups.empty) {
      throw new Error('Kod i pavlefshëm — kontrollo nëse e ke shkruar saktë.');
    }

    const groupId = matchingGroups.docs[0].id;

    return runTransaction(this.firestore, async (tx) => {
      const userRef = doc(this.firestore, 'users', userId);
      const groupRef = doc(this.firestore, 'groups', groupId);

      const userSnap = await tx.get(userRef);
      const groupSnap = await tx.get(groupRef);

      if (!groupSnap.exists()) {
        throw new Error('Grupi nuk ekziston më.');
      }

      const groupIds: string[] = (userSnap.data()?.['groupIds'] as string[]) ?? [];
      if (groupIds.includes(groupId)) {
        throw new Error('Je tashmë anëtar i këtij grupi.');
      }
      if (groupIds.length >= MAX_GROUPS) {
        throw new Error(`Ke arritur limitin prej ${MAX_GROUPS} grupesh.`);
      }

      tx.update(groupRef, { memberIds: arrayUnion(userId) });
      tx.update(userRef, { groupIds: arrayUnion(groupId) });

      return groupId;
    });
  }

  getUserGroups(userId: string): Observable<Group[]> {
    const groupsRef = collection(this.firestore, 'groups');
    const q = query(groupsRef, where('memberIds', 'array-contains', userId));
    return collectionData(q, { idField: 'id' }) as Observable<Group[]>;
  }

  getGroup(groupId: string): Observable<Group | undefined> {
    const ref = doc(this.firestore, 'groups', groupId);
    return docData(ref, { idField: 'id' }) as Observable<Group | undefined>;
  }

  /** Profilet e anëtarëve të një grupi (deri 30 — limit i Firestore për query "in") */
  getMembers(memberIds: string[]): Observable<UserProfile[]> {
    if (memberIds.length === 0) return of([]);
    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, where(documentId(), 'in', memberIds.slice(0, 30)));
    return collectionData(q, { idField: 'uid' }) as Observable<UserProfile[]>;
  }

  private requireUserId(): string {
    const userId = this.auth.currentUser?.uid;
    if (!userId) throw new Error('Duhet të jesh i loguar.');
    return userId;
  }
}