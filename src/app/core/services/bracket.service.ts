import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  setDoc,
  query,
  where,
  orderBy,
  getDoc,
  writeBatch,
  increment
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, of } from 'rxjs';
import { Bracket, BracketPrediction } from '../models/bracket.model';

@Injectable({ providedIn: 'root' })
export class BracketService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  getBrackets(): Observable<Bracket[]> {
    const ref = collection(this.firestore, 'brackets');
    const q = query(ref, orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Bracket[]>;
  }

  getBracket(bracketId: string): Observable<Bracket | undefined> {
    const ref = doc(this.firestore, 'brackets', bracketId);
    return docData(ref, { idField: 'id' }) as Observable<Bracket | undefined>;
  }

  getMyPrediction(bracketId: string): Observable<BracketPrediction | undefined> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) return of(undefined);
    const ref = doc(this.firestore, 'bracketPredictions', `${userId}_${bracketId}`);
    return docData(ref, { idField: 'id' }) as Observable<BracketPrediction | undefined>;
  }

  getLeaderboard(bracketId: string): Observable<BracketPrediction[]> {
    const ref = collection(this.firestore, 'bracketPredictions');
    const q = query(ref, where('bracketId', '==', bracketId), orderBy('totalPoints', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<BracketPrediction[]>;
  }

  /** Ruaj/përditëso bracket-in e plotë të userit (i lejuar vetëm para deadline-it) */
  async submitBracket(bracketId: string, picks: Record<string, string>): Promise<void> {
    const userId = this.auth.currentUser?.uid;
    const user = this.auth.currentUser;
    if (!userId || !user) throw new Error('Duhet të jesh i loguar.');

    const bracketSnap = await getDoc(doc(this.firestore, 'brackets', bracketId));
    if (!bracketSnap.exists()) throw new Error('Bracket-i nuk u gjet.');
    const bracket = bracketSnap.data() as Bracket;
    if (bracket.deadline <= Date.now()) throw new Error('Parashikimet janë mbyllur për këtë bracket.');

    const predId = `${userId}_${bracketId}`;
    const existing = await getDoc(doc(this.firestore, 'bracketPredictions', predId));

    const prediction: BracketPrediction = {
      id: predId,
      userId,
      displayName: user.displayName ?? user.email ?? 'Player',
      bracketId,
      picks,
      createdAt: existing.exists() ? (existing.data() as BracketPrediction).createdAt : Date.now(),
      updatedAt: Date.now()
    };

    await setDoc(doc(this.firestore, 'bracketPredictions', predId), prediction);
  }

  /** USER: kërko pikët e fituara — vetë-shërbim, i shton totalPoints globale të profilit */
  async claimPoints(predictionId: string, points: number): Promise<void> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) throw new Error('Duhet të jesh i loguar.');

    const predRef = doc(this.firestore, 'bracketPredictions', predictionId);
    const userRef = doc(this.firestore, 'users', userId);

    const batch = writeBatch(this.firestore);
    batch.update(predRef, { claimed: true });
    batch.update(userRef, { totalPoints: increment(points) });
    await batch.commit();
  }
}
