import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, docData, setDoc, query, where, orderBy, limit } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, of } from 'rxjs';
import { ChallengeType, DailyChallengeV2, ChallengeResult } from '../models/challenge.model';

@Injectable({ providedIn: 'root' })
export class ChallengeService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  getChallenge<T>(type: ChallengeType): Observable<DailyChallengeV2<T> | undefined> {
    const id = `${this.today()}_${type}`;
    const ref = doc(this.firestore, 'challenges', id);
    return docData(ref, { idField: 'id' }) as Observable<DailyChallengeV2<T> | undefined>;
  }

  getMyResult(type: ChallengeType): Observable<ChallengeResult | undefined> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return of(undefined);
    const id = `${this.today()}_${type}_${uid}`;
    const ref = doc(this.firestore, 'challengeResults', id);
    return docData(ref, { idField: 'id' }) as Observable<ChallengeResult | undefined>;
  }

  getLeaderboard(type: ChallengeType): Observable<ChallengeResult[]> {
    const ref = collection(this.firestore, 'challengeResults');
    const q = query(
      ref,
      where('date', '==', this.today()),
      where('type', '==', type),
      where('solved', '==', true),
      orderBy('attempts', 'asc'),
      orderBy('solvedInSeconds', 'asc'),
      limit(20)
    );
    return collectionData(q, { idField: 'id' }) as Observable<ChallengeResult[]>;
  }

  async submitResult(
    type: ChallengeType,
    solved: boolean,
    attempts: number,
    solvedInSeconds: number
  ): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    const user = this.auth.currentUser;
    if (!uid || !user) return;
    const date = this.today();
    const id = `${date}_${type}_${uid}`;
    await setDoc(doc(this.firestore, 'challengeResults', id), {
      id, type, date,
      userId: uid,
      displayName: user.displayName ?? user.email ?? 'Player',
      solved, attempts, solvedInSeconds,
      createdAt: Date.now()
    });
  }

  /** Fuzzy match for answer checking — case insensitive, ignore accents */
  normalise(s: string): string {
    return s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]/g, '')
      .trim();
  }

  isCorrect(input: string, answer: string): boolean {
    const ni = this.normalise(input);
    const na = this.normalise(answer);
    return ni === na || na.includes(ni) || ni.includes(na);
  }

  /** Search teams from football-data.org for autocomplete */
  async searchTeams(query: string): Promise<string[]> {
    // Client-side filtering from a small cached list is fine since teams are fetched by the game component
    return [];
  }
}
