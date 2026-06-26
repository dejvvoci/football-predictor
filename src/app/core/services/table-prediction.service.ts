import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, collectionData, doc, docData,
  setDoc, query, where, orderBy, limit, getDocs
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, of } from 'rxjs';
import { TableSeason, TablePrediction } from '../models/table-prediction.model';

@Injectable({ providedIn: 'root' })
export class TablePredictionService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  getActiveSeasons(): Observable<TableSeason[]> {
    const ref = collection(this.firestore, 'tableSeasons');
    const q = query(ref, where('active', '==', true));
    return collectionData(q, { idField: 'id' }) as Observable<TableSeason[]>;
  }

  getSeason(code: string, season: number): Observable<TableSeason | undefined> {
    const ref = doc(this.firestore, 'tableSeasons', `${code}_${season}`);
    return docData(ref, { idField: 'id' }) as Observable<TableSeason | undefined>;
  }

  getMyPrediction(code: string, season: number): Observable<TablePrediction | undefined> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return of(undefined);
    const ref = doc(this.firestore, 'tablePredictions', `${code}_${season}_${uid}`);
    return docData(ref, { idField: 'id' }) as Observable<TablePrediction | undefined>;
  }

  getLeaderboard(code: string, season: number): Observable<TablePrediction[]> {
    const ref = collection(this.firestore, 'tablePredictions');
    const q = query(
      ref,
      where('code', '==', code),
      where('season', '==', season),
      where('score', '>', 0),
      orderBy('score', 'desc'),
      limit(30)
    );
    return collectionData(q, { idField: 'id' }) as Observable<TablePrediction[]>;
  }

  async savePrediction(
    season: TableSeason,
    orderedTeamNames: string[]
  ): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    const user = this.auth.currentUser;
    if (!uid || !user) return;

    const id = `${season.code}_${season.season}_${uid}`;
    await setDoc(doc(this.firestore, 'tablePredictions', id), {
      id,
      userId: uid,
      displayName: user.displayName ?? user.email ?? 'Player',
      competition: season.competition,
      code: season.code,
      season: season.season,
      prediction: orderedTeamNames,
      createdAt: Date.now()
    });
  }

  /** Calculate score for a prediction vs actual standings */
  computeScore(prediction: string[], standings: { teamShortName: string }[]): number {
    let total = 0;
    standings.forEach((entry, actualIndex) => {
      const predictedIndex = prediction.findIndex(
        p => p.toLowerCase() === entry.teamShortName.toLowerCase()
      );
      if (predictedIndex >= 0) {
        const diff = Math.abs(predictedIndex - actualIndex);
        total += Math.max(0, 10 - diff);
      }
    });
    return total;
  }
}