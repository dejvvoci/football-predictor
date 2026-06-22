import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  getDocs,
  runTransaction,
  arrayUnion,
  arrayRemove,
  documentId
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, of } from 'rxjs';
import { Group } from '../models/group.model';
import { UserProfile } from '../models/user.model';

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

  /** Krijon grup të ri */
  async createGroup(name: string): Promise<string> {
    const userId = this.requireUserId();

    return runTransaction(this.firestore, async (tx) => {
      const userRef = doc(this.firestore, 'users', userId);
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

  /** Anëtarësim me kod ftese */
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

      tx.update(groupRef, { memberIds: arrayUnion(userId) });
      tx.update(userRef, { groupIds: arrayUnion(groupId) });

      return groupId;
    });
  }

  /** Largim nga grupi — funksionon edhe nëse je pronari (grupi mbetet, thjesht pa atë anëtar) */
  async leaveGroup(groupId: string): Promise<void> {
    const userId = this.requireUserId();

    await runTransaction(this.firestore, async (tx) => {
      const userRef = doc(this.firestore, 'users', userId);
      const groupRef = doc(this.firestore, 'groups', groupId);

      tx.update(groupRef, { memberIds: arrayRemove(userId) });
      tx.update(userRef, { groupIds: arrayRemove(groupId) });
    });
  }

  /** Pronari heq një anëtar nga grupi (vetë profili i tij pastrohet më vonë, te syncMembership) */
  async removeMember(groupId: string, memberUserId: string): Promise<void> {
    const groupRef = doc(this.firestore, 'groups', groupId);
    await updateDoc(groupRef, { memberIds: arrayRemove(memberUserId) });
  }

  /** Vetëm pronari mund ta thërrasë me sukses (e zbaton edhe firestore.rules) */
  async renameGroup(groupId: string, newName: string): Promise<void> {
    const groupRef = doc(this.firestore, 'groups', groupId);
    await updateDoc(groupRef, { name: newName });
  }

  /** Fshin krejt grupin; vetëm pronari mund ta bëjë (e zbaton edhe firestore.rules) */
  async deleteGroup(groupId: string): Promise<void> {
    const userId = this.requireUserId();
    await deleteDoc(doc(this.firestore, 'groups', groupId));
    await updateDoc(doc(this.firestore, 'users', userId), { groupIds: arrayRemove(groupId) });
  }

  /**
   * "Vetë-shërim": kontrollon nëse useri është ende vërtet anëtar i çdo grupi që ka te `groupIds`
   * (grupi mund të jetë fshirë, ose mund të jetë hequr nga pronari) — heq referencat e vjetruara.
   * Thirret çdo herë që hapet "Grupet e mia", që limiti i 3 grupeve të mos bllokohet kot.
   */
  async syncMembership(userId: string): Promise<void> {
    const userSnap = await getDoc(doc(this.firestore, 'users', userId));
    const groupIds: string[] = (userSnap.data()?.['groupIds'] as string[]) ?? [];
    if (groupIds.length === 0) return;

    const staleGroupIds: string[] = [];

    for (const groupId of groupIds) {
      const groupSnap = await getDoc(doc(this.firestore, 'groups', groupId));
      const memberIds: string[] = groupSnap.exists() ? ((groupSnap.data()['memberIds'] as string[]) ?? []) : [];

      if (!groupSnap.exists() || !memberIds.includes(userId)) {
        staleGroupIds.push(groupId);
      }
    }

    if (staleGroupIds.length > 0) {
      await updateDoc(doc(this.firestore, 'users', userId), { groupIds: arrayRemove(...staleGroupIds) });
    }
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
