import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, collectionData, doc, docData,
  setDoc, query, where, orderBy, limit
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, of } from 'rxjs';
import { DailyChallenge, DailyChallengeResult } from '../models/daily-challenge.model';

@Injectable({ providedIn: 'root' })
export class DailyChallengeService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  getTodaysChallenge(): Observable<DailyChallenge | undefined> {
    const ref = doc(this.firestore, 'dailyChallenges', this.today());
    return docData(ref, { idField: 'id' }) as Observable<DailyChallenge | undefined>;
  }

  getMyResult(): Observable<DailyChallengeResult | undefined> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return of(undefined);
    const ref = doc(this.firestore, 'dailyChallengeResults', `${this.today()}_${uid}`);
    return docData(ref, { idField: 'id' }) as Observable<DailyChallengeResult | undefined>;
  }

  getLeaderboard(): Observable<DailyChallengeResult[]> {
    const ref = collection(this.firestore, 'dailyChallengeResults');
    const q = query(
      ref,
      where('date', '==', this.today()),
      where('solved', '==', true),
      orderBy('attempts', 'asc'),
      orderBy('solvedInSeconds', 'asc'),
      limit(20)
    );
    return collectionData(q, { idField: 'id' }) as Observable<DailyChallengeResult[]>;
  }

  /** Search player names via TheSportsDB for autocomplete */
  async searchPlayers(query: string): Promise<string[]> {
    if (query.length < 2) return [];
    try {
      const url = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json() as { players?: { strPlayer: string }[] };
      return (data.players ?? []).map((p) => p.strPlayer).slice(0, 6);
    } catch {
      return [];
    }
  }

  async submitResult(
    solved: boolean,
    attempts: number,
    solvedInSeconds: number
  ): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    const user = this.auth.currentUser;
    if (!uid || !user) return;

    const date = this.today();
    const id = `${date}_${uid}`;
    await setDoc(doc(this.firestore, 'dailyChallengeResults', id), {
      date,
      userId: uid,
      displayName: user.displayName ?? user.email ?? 'Player',
      solved,
      attempts,
      solvedInSeconds,
      createdAt: Date.now()
    });
  }
}